import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { paneState, fmt } from './state.js';
import '@xterm/xterm/css/xterm.css';

addEventListener('error', e => diag('window error: ' + e.message + ' @' + e.filename + ':' + e.lineno));
addEventListener('unhandledrejection', e => diag('unhandled rejection: ' + e.reason));

const grid = document.getElementById('grid');
const tally = document.getElementById('tally');
const panes = new Map();          // id -> { term, fit, el, dot, profile, alive }
let nextId = 1;
let focused = null;
let zoomed = null;

const THEME = {
  background: '#0f1116', foreground: '#d7dbe2', cursor: '#d6547a',
  selectionBackground: '#2c3140',
  black: '#0f1116', red: '#e0708f', green: '#5cba8a', yellow: '#dfa03a',
  blue: '#5b9cd6', magenta: '#b98ad6', cyan: '#4fb6bd', white: '#d7dbe2',
  brightBlack: '#5b606b', brightRed: '#ef8aa5', brightGreen: '#76d3a3',
  brightYellow: '#f0b95c', brightBlue: '#7db4e6', brightMagenta: '#cda4e6',
  brightCyan: '#6fd0d6', brightWhite: '#ffffff',
};

/* ── layout ───────────────────────────────────────────────────────────────
   Panes tile automatically. Columns grow with pane count so nothing is ever
   hidden behind a tab — seeing every session at once is the point.          */
function relayout() {
  const n = panes.size;
  if (!n) {
    grid.style.gridTemplateColumns = '1fr';
    grid.innerHTML =
      '<div id="empty">no sessions — <kbd>ctrl+shift+T</kbd> or pick a profile above</div>';
    return;
  }
  document.getElementById('empty')?.remove();
  const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  grid.style.gridTemplateRows = `repeat(${Math.ceil(n / cols)}, minmax(0, 1fr))`;
  // rAF, not a microtask: microtasks run BEFORE layout, so fit() would measure
  // a pane that has no size yet and produce a ~1-column terminal. That bug shipped
  // once — every pane rendered a single glyph and swallowed all output.
  requestAnimationFrame(fitAll);
}

const fitAll = () => panes.forEach(p => refit(p));

function refit(p) {
  const box = p.el.querySelector('.term');
  if (!box || box.clientWidth < 20 || box.clientHeight < 20) return; // not laid out yet
  try {
    p.fit.fit();
  } catch (e) {
    diag(`fit failed on pane ${p.id}: ${e}`);
    return;
  }
  const { cols, rows } = p.term;
  if (!cols || !rows || cols < 2 || rows < 2) {
    diag(`pane ${p.id} refused degenerate size ${cols}x${rows} (box ${box.clientWidth}x${box.clientHeight})`);
    return;
  }
  if (p.cols === cols && p.rows === rows) return; // nothing changed; don't spam the PTY
  p.cols = cols;
  p.rows = rows;
  invoke('pty_resize', { id: p.id, cols, rows });
}

/** Anything the UI needs to say out loud. Goes to the app's stdout so a failure
 *  is observable without a human squinting at the window. */
const diag = msg => { invoke('diag', { msg: String(msg) }).catch(() => {}); };

/* ── panes ─────────────────────────────────────────────────────────────── */
async function newPane(profile = 'powershell') {
  const id = nextId++;

  const el = document.createElement('div');
  el.className = 'pane';
  el.innerHTML =
    `<div class="head"><span class="dot"></span><span class="name">${profile}</span>` +
    `<span class="id">#${id}</span>` +
    `<span class="state">starting</span>` +
    `<span class="mode" title="raw output ⇄ plain english (ctrl+shift+E)">raw</span>` +
    `<span class="x" title="close">✕</span></div>` +
    `<div class="term"></div>` +
    `<div class="flow"><div class="flow-status">watching for a session…</div><div class="cards"></div></div>`;
  grid.appendChild(el);

  const term = new Terminal({
    theme: THEME,
    fontFamily: 'Cascadia Mono, Consolas, monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 10000,           // bounded on purpose: unbounded scrollback is the memory leak
    allowProposedApi: true,
    macOptionIsMeta: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(el.querySelector('.term'));

  // GPU rendering. If the context is lost (driver reset, sleep/wake) fall back
  // to canvas rather than freezing — a dead renderer looks like a hung agent.
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch { /* no WebGL — xterm falls back on its own */ }

  const p = { id, term, fit, el, profile, alive: true, cols: 0, rows: 0, bytes: 0, born: Date.now(),
              dot: el.querySelector('.dot'),
              flow: el.querySelector('.flow'),
              cards: el.querySelector('.cards'),
              status: el.querySelector('.flow-status'),
              modeEl: el.querySelector('.mode'),
              stateEl: el.querySelector('.state'),
              sem: false, pinned: true,
              // M3 state: tools called but not yet finished, keyed by tool_use id
              pending: new Map(), lastByte: 0, lastCardAt: 0, lastKind: null, bellAt: 0,
              burst: 0, quietSince: 0,
              own: false };  // not this pane's own session until the watcher says so
  panes.set(id, p);

  // The bell is Claude Code asking for you by name — the one unambiguous signal
  // in the whole stream. xterm surfaces it for us, so we never touch the bytes.
  term.onBell(() => { p.bellAt ||= Date.now(); });
  p.modeEl.addEventListener('click', e => { e.stopPropagation(); setMode(p, !p.sem); });
  // Stop auto-scrolling the moment the user scrolls up. Yanking someone away from
  // what they are reading is the terminal behaviour this app exists to fix.
  p.flow.addEventListener('scroll', () => {
    p.pinned = p.flow.scrollHeight - p.flow.scrollTop - p.flow.clientHeight < 40;
  });

  // The pane is sized by CSS grid, which settles after JS runs. A ResizeObserver
  // fires exactly when it actually has a size — the only reliable moment to fit.
  p.ro = new ResizeObserver(() => refit(p));
  p.ro.observe(el.querySelector('.term'));

  // Input goes straight out. It never waits on rendering or on the reader
  // thread, which is what keeps typing instant while agents flood output.
  // Typing IS the answer to "does this need you". Whatever it was asking, you
  // are now dealing with it, so the alarm stops.
  term.onData(data => { p.bellAt = 0; p.el.classList.remove('unseen'); invoke('pty_write', { id, data }); });
  el.addEventListener('mousedown', () => focus(id));
  el.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); closePane(id); });

  relayout();
  focus(id);

  // Wait for the pane to actually have a size before spawning, so the shell's
  // first output lands in a correctly-sized terminal instead of a 1-column one.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  refit(p);

  try {
    await invoke('pty_spawn', {
      id, profile,
      cwd: workdir,
      cols: p.cols || 80,
      rows: p.rows || 24,
    });
    diag(`pane ${id} (${profile}) spawned at ${p.cols || 80}x${p.rows || 24}`);
    // The semantic layer is strictly additive: if it never attaches, the terminal
    // above is untouched and fully usable.
    if (profile === 'claude' && workdir) {
      invoke('sem_attach', { id, cwd: workdir }).catch(e => diag(`sem_attach failed on ${id}: ${e}`));
    } else {
      p.status.textContent = profile === 'claude'
        ? 'no working folder — nothing to correlate'
        : `plain english needs a claude session (this pane is ${profile})`;
    }
  } catch (e) {
    term.writeln(`\r\n\x1b[31mfailed to start ${profile}: ${e}\x1b[0m`);
    diag(`pane ${id} (${profile}) FAILED to spawn: ${e}`);
    markDead(id);
  }
}

/* ── M3: what is happening right now ───────────────────────────────────────
   M2 answered "what happened". This answers "does this need me", which is the
   question that actually costs time — an agent asks for permission, you are in
   another window, and twelve minutes go by.

   Nothing here scrapes the terminal for prompt text. State is derived from two
   things we already have honestly:

     · the bell, which is Claude Code asking for you by name
     · an outstanding tool call — one whose result has not arrived — combined
       with a terminal that has gone quiet

   That second signal is the useful one. A tool that is *running* produces
   output. A tool that has been called, has produced nothing, and is not
   finishing is a tool waiting on a human. It works without knowing a single
   thing about how the prompt is drawn, so it survives Claude Code changing it. */

let lastTitle = '';

/* Throughput floor, in decayed bytes. Output decays ~45% per tick, so a pane
   streaming R bytes/sec settles near 1.1·R — this floor is roughly "700 bytes a
   second, sustained". Comfortably above an idle repaint, comfortably below
   anything that counts as progress. */
const BURST_FLOOR = 800;
const DECAY = 0.55;

function tick() {
  const now = Date.now();
  let needs = 0, working = 0;

  panes.forEach(p => {
    p.burst *= DECAY;
    if (p.burst < BURST_FLOOR) p.quietSince ||= now;
    else p.quietSince = 0;

    const s = paneState(p, now);
    const changed = s.key !== p.state?.key;
    p.state = s;
    p.el.dataset.state = s.key;
    p.stateEl.textContent = s.since > 1500 ? `${s.label} · ${fmt(s.since)}` : s.label;
    if (s.key === 'needs') needs++;
    else if (s.key === 'work') working++;
    // Entering "needs you" is the moment worth a nudge. Staying in it is not —
    // repeating the nudge every second is how a good signal becomes wallpaper.
    if (changed) {
      if (s.key === 'needs') p.el.classList.add('unseen');
      // Why did it say that? A state machine that decides when to interrupt
      // someone should be able to account for itself afterwards.
      diag(`pane ${p.id} → ${s.key} (${s.label}) burst=${Math.round(p.burst)}`);
    }
  });

  const bits = [];
  if (needs) bits.push(`${needs} needs you`);
  if (working) bits.push(`${working} working`);
  tally.textContent = bits.join(' · ');
  tally.classList.toggle('alert', needs > 0);

  // The title is the only part of the cockpit visible when AgentSwarm is not the
  // window you are looking at — which is the whole problem. It always carries the
  // session count, so a glance at the taskbar is never ambiguous about whether
  // the app is reporting or merely sitting there.
  const n = panes.size;
  const title = needs
    ? `● ${needs} needs you — AgentSwarm`
    : n ? `AgentSwarm — ${n} session${n > 1 ? 's' : ''}` : 'AgentSwarm';
  if (title !== lastTitle) {
    const rising = needs > 0 && !lastTitle.startsWith('●');
    lastTitle = title;
    invoke('set_attention', { title, flash: rising })
      .catch(e => diag(`set_attention failed: ${e}`));  // never swallow this again
  }
}
setInterval(tick, 500);

/** Jump to whatever is waiting on you, oldest first. The point of a cockpit is
 *  that you never have to go looking. */
function jumpToNeedy() {
  const waiting = [...panes.values()]
    .filter(p => p.state?.key === 'needs')
    .sort((a, b) => b.state.since - a.state.since);
  if (!waiting.length) return;
  // already on the oldest? move to the next one instead of doing nothing
  const i = waiting.findIndex(p => p.id === focused);
  focus(waiting[(i + 1) % waiting.length].id);
}

/* ── the toggle ────────────────────────────────────────────────────────────
   Same live session, two readings. Raw is the terminal, unmodified — this is
   never a replacement for it. Flow is what actually happened, in sentences.
   Switching is instant because both views are always resident; the cards keep
   arriving while you are looking at raw, so flipping never shows a gap.        */
function setMode(p, sem) {
  p.sem = sem;
  p.el.classList.toggle('semantic', sem);
  p.modeEl.textContent = sem ? 'flow' : 'raw';
  if (sem) {
    if (p.pinned) p.flow.scrollTop = p.flow.scrollHeight;
  } else {
    requestAnimationFrame(() => { refit(p); p.term.focus(); });
  }
}

const ICON = { you: '▸', claude: '✦', tool: '⚙', result: '·' };

function addCard(c) {
  const p = panes.get(c.pane);
  if (!p) return;
  if (!p.semLive) { p.semLive = true; diag(`pane ${p.id} semantic layer live`); }

  // M3 bookkeeping. A tool card opens a question; its result closes it. The gap
  // between them, when the terminal is also silent, is where you are the blocker.
  p.lastCardAt = Date.now();
  p.lastKind = c.kind;
  if (c.kind === 'tool' && c.id) p.pending.set(c.id, { name: c.title, at: Date.now() });
  else if (c.kind === 'result' && c.id) p.pending.delete(c.id);
  // The transcript moving at all means the agent is unblocked.
  if (c.kind !== 'tool') p.bellAt = 0;

  // An empty result closes its call and says nothing worth a row in the timeline.
  if (c.kind === 'result' && !c.body) return;

  p.status.style.display = 'none';

  const d = document.createElement('div');
  d.className = `card ${c.kind}`;
  const head = document.createElement('div');
  head.className = 'card-head';
  head.textContent = `${ICON[c.kind] ?? '·'} ${c.title}`;
  const t = document.createElement('span');
  t.className = 'card-ts';
  t.textContent = c.ts;
  head.appendChild(t);
  const body = document.createElement('div');
  body.className = 'card-body';
  body.textContent = c.body;          // textContent, not innerHTML: transcript text is untrusted
  d.append(head, body);
  p.cards.appendChild(d);

  // Bounded on purpose. An all-day session must not grow the DOM without limit.
  while (p.cards.childElementCount > 500) p.cards.firstElementChild.remove();
  if (p.pinned) p.flow.scrollTop = p.flow.scrollHeight;

  // A quiet badge when something happened in a pane you are not watching.
  if (focused !== c.pane) p.el.classList.add('unseen');
}

function focus(id) {
  const p = panes.get(id);
  if (!p) return;
  focused = id;
  panes.forEach(q => q.el.classList.toggle('focus', q.id === id));
  p.el.classList.remove('unseen');
  if (!p.sem) p.term.focus();
}

function markDead(id) {
  const p = panes.get(id);
  if (!p) return;
  p.alive = false;
  p.dot.classList.add('dead');
}

function closePane(id) {
  const p = panes.get(id);
  if (!p) return;
  invoke('pty_kill', { id });
  p.term.dispose();
  p.el.remove();
  panes.delete(id);
  if (zoomed === id) zoomed = null;
  relayout();
  if (focused === id) {
    const next = panes.keys().next();
    if (!next.done) focus(next.value);
  }
}

function toggleZoom() {
  if (!focused) return;
  const p = panes.get(focused);
  if (!p) return;
  if (zoomed === focused) {
    p.el.classList.remove('zoom');
    panes.forEach(q => (q.el.style.display = ''));
    zoomed = null;
  } else {
    if (zoomed) panes.get(zoomed)?.el.classList.remove('zoom');
    panes.forEach(q => (q.el.style.display = q.id === focused ? '' : 'none'));
    p.el.classList.add('zoom');
    zoomed = focused;
  }
  requestAnimationFrame(fitAll);
}

function cycle(dir) {
  const ids = [...panes.keys()];
  if (!ids.length) return;
  const i = ids.indexOf(focused);
  focus(ids[(i + dir + ids.length) % ids.length]);
}

/* ── wiring ────────────────────────────────────────────────────────────────
   These listeners are the app's spine. They were dead for an entire milestone
   because src-tauri/capabilities/ did not exist — Tauri 2 grants nothing by
   default, so listen() was denied and every pane sat blank while Rust happily
   emitted into the void. Hence the loud .catch: a denied listener must announce
   itself, not fail politely.                                                   */
listen('pty:data', e => {
  const p = panes.get(e.payload.id);
  if (!p) return;
  p.bytes += e.payload.data.length;
  p.lastByte = Date.now();
  p.burst += e.payload.data.length;   // throughput, which is what M3 reads as liveness
  p.term.write(e.payload.data);
}).catch(err => diag('FATAL listener[pty:data] denied: ' + err));

listen('pty:exit', e => {
  markDead(e.payload.id);
  panes.get(e.payload.id)?.term.writeln('\r\n\x1b[90m[session ended]\x1b[0m');
}).catch(err => diag('FATAL listener[pty:exit] denied: ' + err));

listen('sem:card', e => addCard(e.payload))
  .catch(err => diag('listener[sem:card] denied: ' + err));

listen('sem:status', e => {
  const p = panes.get(e.payload.pane);
  if (!p) return;
  p.status.textContent = e.payload.text;
  // Switching to our own session invalidates everything the borrowed one told us.
  if (e.payload.own && !p.own) { p.pending.clear(); p.lastKind = null; }
  p.own = e.payload.own;
  p.el.classList.toggle('borrowed', !e.payload.own);
  diag(`pane ${p.id} transcript: ${e.payload.text}${e.payload.own ? '' : ' (context only)'}`);
}).catch(err => diag('listener[sem:status] denied: ' + err));

// Self-check. A pane that is alive but has received nothing is broken, and M1
// shipped exactly that way — nine blank panes, no error anywhere. So the app now
// accuses itself, on screen, where a human will actually see it. Silence is the
// failure mode this product exists to eliminate; it cannot be our failure mode.
setInterval(() => {
  panes.forEach(p => {
    if (!p.alive || p.checked) return;
    if (Date.now() - (p.born ?? 0) < 3000) return;
    p.checked = true;
    diag(`pane ${p.id} (${p.profile}) after 3s: ${p.bytes} bytes received, term ${p.term.cols}x${p.term.rows}`);
    if (p.bytes === 0) {
      p.term.writeln('\r\n\x1b[31m[agentswarm] this pane started but received no output in 3s.\x1b[0m');
      p.term.writeln('\x1b[31m            the shell is running; the app is not showing it.\x1b[0m');
    }
  });
}, 1000);

addEventListener('keydown', e => {
  if (!(e.ctrlKey && e.shiftKey)) return;
  const k = e.key.toLowerCase();
  const hit = () => { e.preventDefault(); e.stopPropagation(); };
  if (k === 't') { hit(); newPane(defaultProfile); }
  else if (k === 'w') { hit(); if (focused) closePane(focused); }
  else if (k === 'z') { hit(); toggleZoom(); }
  else if (k === 'e') { hit(); const p = panes.get(focused); if (p) setMode(p, !p.sem); }
  else if (e.key === ' ') { hit(); jumpToNeedy(); }
  // Flip the whole cockpit at once — the "what is everyone doing" view.
  else if (k === 'a') { hit(); const on = ![...panes.values()].every(p => p.sem); panes.forEach(p => setMode(p, on)); }
  else if (e.key === 'ArrowRight') { hit(); cycle(1); }
  else if (e.key === 'ArrowLeft') { hit(); cycle(-1); }
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitAll, 60);   // debounced: resize storms shouldn't spam the PTY
});

/* ── boot ──────────────────────────────────────────────────────────────── */
let defaultProfile = 'powershell';
let workdir = null;

(async () => {
  let profiles = ['powershell'];
  try { profiles = await invoke('available_profiles'); } catch { /* keep the default */ }
  if (profiles.includes('claude')) defaultProfile = 'claude';
  try { workdir = await invoke('default_cwd'); } catch { /* panes inherit instead */ }

  const bar = document.getElementById('profiles');
  for (const name of profiles) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => newPane(name));
    bar.appendChild(b);
  }

  relayout();
  newPane(defaultProfile);
})();
