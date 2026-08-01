import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { paneState, fmt } from './state.js';
import { score, insertOrdered } from './order.js';
import { lastMeaningful } from './peek.js';
import { runDemo } from './demo.js';
import '@xterm/xterm/css/xterm.css';

addEventListener('error', e => diag('window error: ' + e.message + ' @' + e.filename + ':' + e.lineno));
addEventListener('unhandledrejection', e => diag('unhandled rejection: ' + e.reason));

const grid = document.getElementById('grid');
const tally = document.getElementById('tally');

/* M7 — the numbers you are allowed to change.
 *
 * M3's thresholds were picked by watching one machine for forty seconds, and the
 * build log's advice if they ever misfired was "change BURST_FLOOR" — useless,
 * because that meant editing source and rebuilding. The baseline week is running
 * now; if the app cries wolf on Tuesday it has to be fixable on Tuesday.
 *
 * Defaults live here too, so a missing or broken settings file still runs. */
const SETTINGS = {
  quiet_ms: 2000,
  stuck_ms: 8000,
  burst_floor: 800,
  scrollback: 10000,   // bounded on purpose: unbounded scrollback is the memory leak
  feed_max: 2000,
  restore_layout: true,
  layout: 'stage',     // 'stage' | 'grid' — stage is the default because a
                       // readable terminal beats nine unreadable ones
};
const panes = new Map();          // id -> { term, fit, el, dot, profile, alive }
let nextId = 1;
let focused = null;
let zoomed = null;

/* The terminal is the largest surface in the app, so its palette IS the app's
 * palette. Warm graphite ground, desaturated signal colours — agent output is
 * read for hours, and saturated ANSI on pure black is what makes an hour feel
 * like three. These track the tokens in style.css; changing one without the
 * other is how a interface stops looking designed and starts looking assembled. */
const THEME = {
  background: '#1b1c21', foreground: '#d8d6d1', cursor: '#d9a05b',
  cursorAccent: '#1b1c21', selectionBackground: '#33363f',
  black: '#1b1c21',   red: '#c9727f',  green: '#6fae86', yellow: '#d9a05b',
  blue: '#7f9dc0',    magenta: '#a98cc0', cyan: '#6aa9a6', white: '#c8c6c1',
  brightBlack: '#55575e', brightRed: '#d98d97', brightGreen: '#8ec5a4',
  brightYellow: '#e8bd82', brightBlue: '#9db8d6', brightMagenta: '#c2a9d6',
  brightCyan: '#8ac4c1', brightWhite: '#f0eeea',
};

/* ── layout ───────────────────────────────────────────────────────────────
   M10. Two layouts over the same panes.

   The grid tiled everything evenly, on the theory that a cockpit should show
   every session at once. Nine panes on one screen makes nine terminals too
   small to read, which was the reported problem — and the theory was wrong.
   Nobody reads nine terminals simultaneously. You read one and monitor the
   rest, so a uniform grid buys nine unreadable terminals to satisfy a need
   nobody has.

   Stage gives the pane you are reading the whole room and keeps the others as
   live cards: state, elapsed, and their most recent line. Awareness survives —
   that is what the muster rail and the cards are for — and the terminal you are
   actually reading is full size.

   Panes move between containers. They are never rebuilt, so scrollback,
   position and process all survive a layout change.                          */
const board = document.getElementById('board');
const railEl = document.getElementById('rail');
const stageEl = document.getElementById('stage');
const emptyEl = document.getElementById('empty');

let layout = 'grid';   // overridden from settings at boot

const stageActive = () => layout === 'stage' && panes.size > 1;

function relayout() {
  const n = panes.size;
  board.dataset.layout = n === 0 ? 'empty' : stageActive() ? 'stage' : 'grid';

  if (!n) {
    // M8 — the first thing a new machine shows should say what the app does.
    emptyEl.innerHTML =
      '<div class="e-title">nothing open</div>' +
      '<div class="e-row"><kbd>ctrl+shift+P</kbd> everything — swarms, panes, search</div>' +
      '<div class="e-row"><kbd>ctrl+shift+T</kbd> a new pane</div>' +
      '<div class="e-row"><kbd>ctrl+shift+M</kbd> every session in the order it happened</div>' +
      '<div class="e-row"><kbd>ctrl+shift+D</kbd> what changed, and why</div>';
    return;
  }

  if (stageActive()) {
    for (const p of panes.values()) {
      const home = p.id === focused ? stageEl : railEl;
      if (p.el.parentElement !== home) home.appendChild(p.el);
      p.el.classList.toggle('carded', p.id !== focused);
    }
  } else {
    const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${Math.ceil(n / cols)}, minmax(0, 1fr))`;
    for (const p of panes.values()) {
      if (p.el.parentElement !== grid) grid.appendChild(p.el);
      p.el.classList.remove('carded');
    }
  }

  // rAF, not a microtask: microtasks run BEFORE layout, so fit() would measure
  // a pane that has no size yet and produce a ~1-column terminal. That bug shipped
  // once — every pane rendered a single glyph and swallowed all output.
  requestAnimationFrame(fitAll);
}

function setLayout(next) {
  layout = next;
  relayout();
  flash(next === 'stage' ? 'stage — one pane at reading size' : 'grid — every pane tiled');
  diag(`layout: ${next}`);
}

/** The most recent line a pane actually printed, for its card in the rail.
 *
 *  A card showing only a state is a status light; a card showing the last line
 *  is a glance at the work. Escape sequences are stripped because a card is not
 *  a terminal — it has no cursor to move and no colours to set. */
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[()][A-Za-z0-9]|\x1b[]][^\x07\x1b]*(\x07|\x1b\\)?|\x1b[=><]|[\x00-\x08\x0b-\x1f\x7f]/g;
function rememberLastLine(p, chunk) {
  const clean = chunk.replace(ANSI, '');
  if (!clean.trim()) return;
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;
  // Take the last line that actually says something. A folded pane showing "8"
  // is worse than one showing nothing: it looks like information and is not.
  const said = lastMeaningful(lines);
  if (!said) return;
  // A repainting TUI rewrites the same line constantly; only keep a change.
  if (said !== p.lastLine) p.lastLine = said.slice(0, 160);
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

/* ── panes ───────────────────────────────────────────────────────────────
   Terminal construction and process spawning are separated from newPane so a
   dead pane can be brought back **in the slot it already occupies**. Closing
   and reopening would work and would also move it to the end of the grid,
   which in a nine-pane cockpit means losing the arrangement you built.       */
function makeTerm(container) {
  const term = new Terminal({
    theme: THEME,
    fontFamily: 'Cascadia Mono, Consolas, monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: SETTINGS.scrollback,
    allowProposedApi: true,
    macOptionIsMeta: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container);
  // GPU rendering. If the context is lost (driver reset, sleep/wake) fall back
  // to canvas rather than freezing — a dead renderer looks like a hung agent.
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch { /* no WebGL — xterm falls back on its own */ }
  return { term, fit };
}

function wireTerm(p) {
  // The bell is Claude Code asking for you by name — the one unambiguous signal
  // in the whole stream. xterm surfaces it for us, so we never touch the bytes.
  p.term.onBell(() => { p.bellAt ||= Date.now(); });
  // Input goes straight out. It never waits on rendering or on the reader
  // thread, which is what keeps typing instant while agents flood output.
  // Typing IS the answer to "does this need you": whatever it was asking, you
  // are now dealing with it, so the alarm stops.
  p.term.onData(data => {
    p.bellAt = 0;
    p.el.classList.remove('unseen');
    invoke('pty_write', { id: p.id, data });
  });
}

/** Start the process for a pane that already has a terminal. */
async function spawnPane(p) {
  // Wait for the pane to actually have a size before spawning, so the shell's
  // first output lands in a correctly-sized terminal instead of a 1-column one.
  //
  // But never wait on rAF alone: a hidden or minimised window does not paint, so
  // the callback never runs and the await never returns — the pane is built,
  // looks alive, and no process is ever started. Timers still fire when frames
  // do not, so the timeout is the escape hatch; the ResizeObserver corrects the
  // size the moment the window is actually shown.
  await Promise.race([
    new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    new Promise(r => setTimeout(r, 250)),
  ]);
  refit(p);

  try {
    await invoke('pty_spawn', {
      id: p.id, profile: p.profile, args: p.args,
      cwd: p.cwd,
      cols: p.cols || 80,
      rows: p.rows || 24,
    });
    p.alive = true;
    p.dot.classList.remove('dead');
    p.born = Date.now();
    p.checked = false;
    diag(`pane ${p.id} (${p.label || p.profile}) spawned at ${p.cols || 80}x${p.rows || 24}` +
         (p.args.length ? ` args=${JSON.stringify(p.args)}` : ''));
    // The semantic layer is strictly additive: if it never attaches, the terminal
    // above is untouched and fully usable.
    // M12 — the backend decides whether this profile has a session to read.
    // The frontend used to check for the string 'claude', which is exactly the
    // hard-wiring this milestone removed.
    if (p.cwd) {
      invoke('sem_attach', { id: p.id, cwd: p.cwd, profile: p.profile })
        .catch(e => diag(`sem_attach failed on ${p.id}: ${e}`));
    } else {
      p.status.textContent = 'no working folder — nothing to correlate';
    }
  } catch (e) {
    p.term.writeln(`\r\n\x1b[31mfailed to start ${p.profile}: ${e}\x1b[0m`);
    diag(`pane ${p.id} (${p.profile}) FAILED to spawn: ${e}`);
    markDead(p.id);
  }
}

/** M7 — bring a pane back without moving it.
 *
 *  A session ends: you type /exit, it crashes, the machine sleeps. Before this,
 *  the only recovery was to close the pane and open a new one, which appends to
 *  the end of the grid and loses the arrangement. The pane keeps its slot, its
 *  label, its folder and its policy — only the process is new. */
async function restartPane(id) {
  const p = panes.get(id);
  if (!p) return;

  invoke('pty_kill', { id }).catch(() => {});
  try { p.ro?.disconnect(); } catch { /* already gone */ }
  try { p.term.dispose(); } catch { /* already gone */ }

  const box = p.el.querySelector('.term');
  box.textContent = '';
  const { term, fit } = makeTerm(box);
  p.term = term;
  p.fit = fit;
  wireTerm(p);
  p.ro = new ResizeObserver(() => refit(p));
  p.ro.observe(box);

  // Everything the old process implied is now false.
  p.cols = 0; p.rows = 0; p.bytes = 0;
  p.pending.clear();
  p.lastByte = 0; p.lastCardAt = 0; p.lastKind = null;
  p.bellAt = 0; p.burst = 0; p.quietSince = 0; p.own = false;
  p.el.classList.remove('unseen', 'borrowed');
  p.status.textContent = 'watching for a session…';
  p.status.style.display = '';

  diag(`pane ${id} restarting`);
  await spawnPane(p);
  flash(`#${id} restarted`);
}

async function newPane(profile = 'powershell', opts = {}) {
  const id = nextId++;
  const label = opts.label || null;
  const paneCwd = opts.cwd || workdir;
  const args = opts.args || [];

  const el = document.createElement('div');
  el.className = 'pane';
  el.innerHTML =
    `<div class="head"><span class="dot"></span><span class="name"></span>` +
    `<span class="id">#${id}</span>` +
    `<span class="state">starting</span>` +
    `<span class="mode" title="raw output ⇄ plain english (ctrl+shift+E)">raw</span>` +
    `<span class="x" title="close">✕</span></div>` +
    `<div class="term"></div>` +
    `<div class="flow"><div class="flow-status">watching for a session…</div><div class="cards"></div></div>` +
    `<div class="peek"></div>`;
  // textContent, not template interpolation: a label comes from a recipe file
  el.querySelector('.name').textContent = label || profile;
  el.querySelector('.name').title = paneCwd || '';
  grid.appendChild(el);

  const { term, fit } = makeTerm(el.querySelector('.term'));

  const p = { id, term, fit, el, profile, label, cwd: paneCwd, args, alive: true, cols: 0, rows: 0, bytes: 0, born: Date.now(),
              dot: el.querySelector('.dot'),
              flow: el.querySelector('.flow'),
              cards: el.querySelector('.cards'),
              status: el.querySelector('.flow-status'),
              modeEl: el.querySelector('.mode'),
              stateEl: el.querySelector('.state'),
              peekEl: el.querySelector('.peek'), lastLine: '',
              sem: false, pinned: true, muted: false,
              // M3 state: tools called but not yet finished, keyed by tool_use id
              pending: new Map(), lastByte: 0, lastCardAt: 0, lastKind: null, bellAt: 0,
              burst: 0, quietSince: 0,
              own: false };  // not this pane's own session until the watcher says so
  panes.set(id, p);

  wireTerm(p);
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

  el.addEventListener('mousedown', () => focus(id));
  // Close on mousedown, and stop the pane's own mousedown from running first.
  //
  // This was broken in the rail: the pane focuses on mousedown, and in stage
  // focusing re-parents the pane into the stage container. The element moved out
  // from under the cursor before mouseup, so the browser never produced a click
  // and the handler that was listening for one never ran. Nothing was wrong with
  // the button; it was being moved away mid-press.
  const close = el.querySelector('.x');
  close.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
  close.addEventListener('click', e => { e.stopPropagation(); closePane(id); });

  relayout();
  focus(id);
  await spawnPane(p);
  rememberLayout();
}

/* ── M5: drive, review, remember ───────────────────────────────────────────
   Three things the cockpit could not do. It could watch panes but not talk to
   them; it could say what an agent *said* it did but not what changed on disk;
   and it could show live sessions but not reach one that had already ended.   */

/** A reusable full-window sheet. Diffs and search are different content in the
 *  same frame, and a second bespoke overlay would be a third set of open/close
 *  bugs to write. */
let sheetOpen = false, sheetKind = null;

function openSheet(kind, title, sub = '') {
  sheetKind = kind;
  sheetOpen = true;
  document.getElementById('sheet').classList.add('open');
  document.getElementById('sh-title').textContent = title;
  document.getElementById('sh-sub').textContent = sub;
  document.getElementById('sh-body').textContent = '';
}
function closeSheet() {
  sheetOpen = false;
  sheetKind = null;
  document.getElementById('sheet').classList.remove('open');
  if (!paletteOpen && !timelineOpen) panes.get(focused)?.term.focus();
}

/* M7 — remember what was open.
 *
 * Written on every change rather than on exit: a process that crashes never
 * reaches an exit handler, and after a crash is exactly when you want your
 * arrangement back. Debounced, because opening a recipe fires this per pane. */
let layoutTimer;
function rememberLayout() {
  if (!workdir) return;
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
    invoke('save_layout', { cwd: workdir, panes: currentSwarm() })
      .catch(e => diag(`save_layout failed: ${e}`));
  }, 400);
}

/** The distinct folders the open panes are working in. */
const paneCwds = () => [...new Set([...panes.values()].map(p => p.cwd).filter(Boolean))];

/* ── drive ─────────────────────────────────────────────────────────────────
   Typing into a pane you are not looking at, and into every pane at once. The
   carriage return is the whole point: this submits. */
function sendTo(id, text) {
  const p = panes.get(id);
  if (!p) return;
  p.bellAt = 0;
  p.el.classList.remove('unseen');
  invoke('pty_write', { id, data: text + '\r' })
    .catch(e => { flash(`could not send to #${id}`); diag(`send to ${id} failed: ${e}`); });
}

function broadcast(text) {
  // A muted pane stays out of it. Broadcast is the one action here that touches
  // every agent at once, so there has to be a way to keep one out without
  // closing it — a reviewer running under a read-only policy should not be
  // handed the same instruction as the pane doing the work.
  const targets = [...panes.values()].filter(p => p.alive && p.profile === 'claude' && !p.muted);
  if (!targets.length) {
    const muted = [...panes.values()].filter(p => p.alive && p.profile === 'claude' && p.muted).length;
    flash(muted ? `every claude pane is muted (${muted})` : 'no claude panes to broadcast to');
    return;
  }
  targets.forEach(p => sendTo(p.id, text));
  flash(`sent to ${targets.length} pane${targets.length > 1 ? 's' : ''}`);
  diag(`broadcast to ${targets.length} pane(s): ${text.slice(0, 80)}`);
}

/* ── review ────────────────────────────────────────────────────────────────
   What actually changed, and which session did it. The second half is the part
   no git client can tell you: attribution comes from the transcript feed, where
   a tool card names the file it wrote.                                        */
const EDITORS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Update']);

function whoTouched(path) {
  const tail = path.replace(/\\/g, '/').toLowerCase();
  const names = new Set();
  for (const c of feed) {
    if (c.kind !== 'tool' || !EDITORS.has(c.title)) continue;
    const said = (c.body || '').replace(/\\/g, '/').toLowerCase();
    if (said.endsWith(tail) || said.includes(tail)) names.add(`#${c.pane} ${c.label}`);
  }
  return [...names];
}

async function showChanges() {
  const cwds = paneCwds();
  openSheet('diff', 'changes', cwds.length > 1 ? `${cwds.length} folders` : cwds[0] || '');
  const body = document.getElementById('sh-body');

  if (!cwds.length) { body.innerHTML = '<div class="sh-empty">no panes open</div>'; return; }
  body.innerHTML = '<div class="sh-empty">reading git…</div>';

  const results = await Promise.all(cwds.map(async cwd => {
    try { return { cwd, ...(await invoke('git_changes', { cwd })) }; }
    catch (e) { return { cwd, files: [], problem: String(e) }; }
  }));

  body.textContent = '';
  let total = 0;
  for (const r of results) {
    const head = document.createElement('div');
    head.className = 'sh-group';
    head.textContent = r.problem ? `${r.cwd} — ${r.problem}`
                                 : `${r.root || r.cwd}${r.branch ? '  ·  ' + r.branch : ''}`;
    body.appendChild(head);

    if (!r.files?.length) {
      const e = document.createElement('div');
      e.className = 'sh-empty';
      e.textContent = r.problem ? '' : 'working tree clean';
      body.appendChild(e);
      continue;
    }
    total += r.files.length;

    for (const f of r.files) {
      const row = document.createElement('div');
      row.className = 'diff-row';
      row.innerHTML = '<span class="d-status"></span><span class="d-path"></span>' +
                      '<span class="d-who"></span><span class="d-count"></span>';
      row.querySelector('.d-status').textContent = f.untracked ? 'new' : f.status.trim();
      row.querySelector('.d-path').textContent = f.path;
      const who = whoTouched(f.path);
      const w = row.querySelector('.d-who');
      w.textContent = who.join(', ');
      if (who.length) w.classList.add('attributed');
      row.querySelector('.d-count').textContent =
        f.untracked ? '' : `+${f.added} −${f.removed}`;
      row.addEventListener('click', () => showDiff(r.cwd, f));
      body.appendChild(row);
    }
  }
  document.getElementById('sh-sub').textContent =
    total ? `${total} changed file${total > 1 ? 's' : ''}` : 'nothing changed';
}

async function showDiff(cwd, f) {
  openSheet('diff', f.path, cwd);
  const body = document.getElementById('sh-body');
  body.innerHTML = '<div class="sh-empty">reading diff…</div>';

  const back = document.createElement('div');
  back.className = 'sh-back';
  back.textContent = '← all changes';
  back.addEventListener('click', showChanges);

  // The diff and the reason for it, fetched together. A diff says what changed;
  // the transcript says why, and the second is the harder question.
  const [text, why] = await Promise.all([
    invoke('git_file_diff', { cwd, path: f.path, untracked: !!f.untracked })
      .catch(e => `could not read the diff: ${e}`),
    invoke('file_history', { cwds: paneCwds(), path: f.path, limit: 40 })
      .catch(e => { diag(`file_history failed: ${e}`); return []; }),
  ]);

  body.textContent = '';
  body.appendChild(back);
  body.appendChild(renderWhy(why));
  const pre = document.createElement('div');
  pre.className = 'diff-text';
  for (const line of text.split('\n')) {
    const d = document.createElement('div');
    d.className = 'dl ' + (line.startsWith('+++') || line.startsWith('---') ? 'meta'
                        : line.startsWith('@@') ? 'hunk'
                        : line.startsWith('+') ? 'add'
                        : line.startsWith('-') ? 'del' : '');
    d.textContent = line || ' ';
    pre.appendChild(d);
  }
  body.appendChild(pre);
}

/* ── remember ──────────────────────────────────────────────────────────────
   Panes are live; transcripts outlast them. This is the only way to answer
   "what did I decide about this", and every hit is quoted with the file and
   line it came from — an answer you can check rather than one you must trust. */
/* M6 — why is this file the way it is.
 *
 * `git blame` answers "who and when" for a line. It cannot answer "why", because
 * the reason was never in the repository — it was in the conversation. Every edit
 * in a transcript names the file it wrote, and what was being said just before it
 * is the reason it happened.
 *
 * This reads all history, so a file changed in a session that ended last week
 * still has an answer. The changed-files list uses the live feed instead, which
 * is instant but only sees panes open right now; the difference is deliberate,
 * because "why" is asked about one file at a time. */
function renderWhy(hits) {
  const box = document.createElement('div');
  box.className = 'why';

  const head = document.createElement('div');
  head.className = 'why-head';
  head.textContent = hits.length
    ? `why — ${hits.length} edit${hits.length > 1 ? 's' : ''} across all history`
    : 'why — no agent edit of this file found in any transcript';
  box.appendChild(head);
  if (!hits.length) return box;

  // Consecutive edits driven by the same explanation are one decision, not five.
  let lastReason = null;
  for (const h of hits) {
    const reason = (h.context || '').trim();
    const row = document.createElement('div');
    row.className = 'why-row';

    if (reason && reason !== lastReason) {
      const r = document.createElement('div');
      r.className = 'why-reason';
      r.textContent = reason;
      row.appendChild(r);
      lastReason = reason;
    }
    const cite = document.createElement('div');
    cite.className = 'why-cite';
    const when = h.iso ? new Date(h.iso) : null;
    cite.textContent =
      `⚙ ${h.title}  ·  ${h.session}:${h.line}` +
      (when && !isNaN(when) ? `  ·  ${when.toLocaleString()}` : '');
    row.appendChild(cite);
    box.appendChild(row);
  }
  return box;
}

async function showSearch(initial = '') {
  openSheet('search', 'search everything', paneCwds().join('  ·  '));
  const body = document.getElementById('sh-body');

  const bar = document.createElement('input');
  bar.className = 'sh-input';
  bar.placeholder = 'what did I decide about…';
  bar.value = initial;
  const out = document.createElement('div');
  body.append(bar, out);

  let timer;
  const run = async () => {
    const q = bar.value.trim();
    if (q.length < 2) { out.innerHTML = '<div class="sh-empty">type at least two characters</div>'; return; }
    out.innerHTML = '<div class="sh-empty">searching…</div>';
    let hits = [];
    try { hits = await invoke('search_history', { cwds: paneCwds(), query: q, limit: 60 }); }
    catch (e) { out.innerHTML = ''; out.textContent = `search failed: ${e}`; return; }

    out.textContent = '';
    if (!hits.length) { out.innerHTML = '<div class="sh-empty">nothing said about that</div>'; return; }
    document.getElementById('sh-sub').textContent = `${hits.length} result${hits.length > 1 ? 's' : ''}`;

    for (const h of hits) {
      const r = document.createElement('div');
      r.className = `hit ${h.kind}`;
      r.innerHTML = '<div class="hit-body"></div><div class="hit-cite"></div>';
      r.querySelector('.hit-body').textContent = h.body;
      // the receipt: which transcript, which line. Without this it is just a guess.
      const when = h.iso ? new Date(h.iso) : null;
      r.querySelector('.hit-cite').textContent =
        `${ICON[h.kind] ?? '·'} ${h.title}  ·  ${h.session}:${h.line}` +
        (when && !isNaN(when) ? `  ·  ${when.toLocaleString()}` : '');
      out.appendChild(r);
    }
  };

  bar.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
  bar.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
    e.stopPropagation();
  });
  bar.focus();
  if (initial) run();
}

/* ── M4: everything, in order ──────────────────────────────────────────────
   The original complaint about the CLI, in the user's words: "it places
   everything in order which claude CLI lacks."

   Per-pane timelines answer "what is this one doing". They cannot answer "what
   happened, across all of them, in the order it happened" — and with five
   sessions running that is the question you actually have. Cards are interleaved
   by their real transcript timestamp, which is why the card carries an ISO
   string rather than a pre-formatted clock face: "16:33" cannot be sorted
   against another session's "16:33".                                          */

const feed = [];            // every card from every pane, in real-time order

function addToFeed(c, p) {
  c.at = Date.parse(c.iso) || Date.now();   // undated cards sort as "now", not 1970
  c.label = p.label || p.profile;
  insertOrdered(feed, c, SETTINGS.feed_max);
  if (timelineOpen) renderTimeline();
}

let timelineOpen = false;
let timelineFilter = null;   // null = every pane

function renderTimeline() {
  const box = document.getElementById('tl-body');
  const rows = timelineFilter == null ? feed : feed.filter(c => c.pane === timelineFilter);
  box.textContent = '';
  if (!rows.length) {
    box.innerHTML = '<div class="tl-empty">nothing yet — the timeline fills as sessions work</div>';
    return;
  }
  let lastDay = '';
  for (const c of rows.slice(-400)) {
    const d = new Date(c.at);
    const day = d.toDateString();
    if (day !== lastDay) {
      lastDay = day;
      const h = document.createElement('div');
      h.className = 'tl-day';
      h.textContent = day;
      box.appendChild(h);
    }
    const row = document.createElement('div');
    row.className = `tl-row ${c.kind}`;
    row.innerHTML =
      `<span class="tl-time"></span><span class="tl-pane"></span>` +
      `<span class="tl-what"></span><span class="tl-body"></span>`;
    row.querySelector('.tl-time').textContent = hhmm(d);
    row.querySelector('.tl-pane').textContent = `#${c.pane} ${c.label}`;
    row.querySelector('.tl-what').textContent = `${ICON[c.kind] ?? '·'} ${c.title}`;
    row.querySelector('.tl-body').textContent = c.body;
    row.addEventListener('click', () => { closeTimeline(); focus(c.pane); });
    box.appendChild(row);
  }
  box.scrollTop = box.scrollHeight;
}

const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function openTimeline(paneId = null) {
  timelineFilter = paneId;
  timelineOpen = true;
  const el = document.getElementById('timeline');
  el.classList.add('open');
  document.getElementById('tl-scope').textContent =
    paneId == null ? 'all sessions' : `pane #${paneId} only`;
  renderTimeline();
}
function closeTimeline() {
  timelineOpen = false;
  document.getElementById('timeline').classList.remove('open');
  panes.get(focused)?.term.focus();
}

/* ── M4: recipes and the command palette ───────────────────────────────────
   A recipe is the swarm you always open together. The milestone's exit test is
   "the morning swarm is one command", so the palette is that command: one
   keystroke, type three letters, enter.

   Saving matters as much as running. You arrange the panes by hand, decide the
   arrangement was right, and keep it — rather than authoring JSON for a layout
   you have not tried yet.                                                     */

let recipes = [];
let profiles = ['powershell'];
let SETTINGS_SOURCE = 'defaults';

/** M8 — what this is and where it keeps things. On an unfamiliar machine the
 *  first question is "where does this store my stuff", and the answer should not
 *  require reading the source. */
async function showAbout() {
  let info = {};
  try { info = await invoke('about'); } catch (e) { diag(`about failed: ${e}`); }
  openSheet('about', `AgentSwarm ${info.version || ''}`, 'the terminal built for agentic coding');
  const body = document.getElementById('sh-body');
  const rows = [
    ['working folder', info.cwd],
    ['config', `${info.config_dir || ''} — recipes.json, settings.json, last-layout.json`],
    ['thresholds', SETTINGS_SOURCE === 'defaults' ? 'defaults (no settings.json yet)' : 'from settings.json'],
    ['transcripts read from', info.transcripts],
    ['recipes loaded', recipes.length ? recipes.map(r => r.name).join(', ') : 'none'],
    ['panes open', String(panes.size)],
  ];
  for (const [k, v] of rows) {
    const d = document.createElement('div');
    d.className = 'about-row';
    d.innerHTML = '<span class="a-k"></span><span class="a-v"></span>';
    d.querySelector('.a-k').textContent = k;
    d.querySelector('.a-v').textContent = v || '—';
    body.appendChild(d);
  }
}

async function loadSettings() {
  if (!workdir) return;
  try {
    const got = await invoke('load_settings', { cwd: workdir });
    Object.assign(SETTINGS, got.settings);
    if (SETTINGS.layout === 'stage' || SETTINGS.layout === 'grid') layout = SETTINGS.layout;
    SETTINGS_SOURCE = got.source === 'defaults' ? 'defaults' : 'from file';
    if (got.problem) { diag(`settings problem: ${got.problem}`); flash('settings file is broken — using defaults'); }
    else if (got.source !== 'defaults') diag(`settings from ${got.source}`);
  } catch (e) { diag(`settings unreadable: ${e}`); }
}

/** Put a settings file on disk and say where it is. Nobody tunes a file they
 *  have to invent from scratch, and "change BURST_FLOOR" is not instructions. */
async function openSettingsFile() {
  try {
    const path = await invoke('write_settings_template', { cwd: workdir });
    flash(`settings: ${path}`);
    diag(`settings file at ${path} — edit and restart to apply`);
  } catch (e) { flash(`could not write settings: ${e}`); }
}

async function refreshRecipes() {
  if (!workdir) { diag('no working folder — recipes not loaded'); return; }
  try {
    const got = await invoke('list_recipes', { cwd: workdir });
    recipes = got.recipes;
    diag(`${recipes.length} recipe(s): ${recipes.map(r => r.name).join(', ') || 'none'}`);
    // A recipe file you wrote and the app rejected is exactly when silence is
    // worst. Say so on screen, not only in a log nobody is tailing.
    for (const p of got.problems) diag(`recipe problem: ${p}`);
    if (got.problems.length) flash(`swarm file has ${got.problems.length} problem(s) — ctrl+shift+P`);
  } catch (e) {
    diag(`recipes unreadable: ${e}`);
    flash('could not read the swarm file');
  }
}

async function runRecipe(r) {
  diag(`swarm "${r.name}": ${r.panes.length} panes`);
  for (const spec of r.panes) {
    // Sequential, not Promise.all: each pane waits for layout before it spawns,
    // and racing them reintroduces the zero-size terminal bug from M1.
    await newPane(spec.profile, { cwd: spec.cwd, args: spec.args, label: spec.label });
  }
}

/** The panes on screen right now, in a form a recipe can be written from. */
function currentSwarm() {
  return [...panes.values()].map(p => ({
    profile: p.profile,
    cwd: p.cwd || workdir,
    label: p.label || null,
    args: p.args || [],
  }));
}

async function saveSwarmAs(name) {
  const panesSpec = currentSwarm();
  if (!panesSpec.length) { flash('nothing open to save'); return; }
  try {
    const path = await invoke('save_recipe', {
      cwd: workdir,
      recipe: { name, description: null, panes: panesSpec },
    });
    await refreshRecipes();
    flash(`saved "${name}" — ${panesSpec.length} panes`);
    diag(`recipe "${name}" saved to ${path}`);
  } catch (e) {
    flash(`could not save: ${e}`);
    diag(`save_recipe failed: ${e}`);
  }
}

/** A short message in the bar. Errors belong on screen, not only in a log. */
let flashTimer;
function flash(msg) {
  const el = document.getElementById('flash');
  el.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

function actions() {
  const list = [];
  for (const r of recipes) {
    list.push({ text: `swarm  ${r.name}`, hint: r.description || `${r.panes.length} panes`, run: () => runRecipe(r) });
  }
  for (const name of profiles) {
    list.push({ text: `new pane  ${name}`, hint: name === defaultProfile ? 'ctrl+shift+T' : '', run: () => newPane(name) });
  }
  list.push({ text: 'save this swarm', hint: `${panes.size} panes open`, ask: 'name for this swarm', run: saveSwarmAs });
  list.push({ text: 'changes  what actually changed on disk', hint: 'ctrl+shift+D', run: showChanges });
  list.push({ text: 'search  everything ever said here', hint: 'ctrl+shift+F', run: () => showSearch() });
  const claudePanes = [...panes.values()].filter(p => p.alive && p.profile === 'claude');
  const willGet = claudePanes.filter(p => !p.muted);
  if (claudePanes.length) {
    // Do not ask for a message nobody will receive. Typing a paragraph and
    // watching it evaporate is a worse way to learn that every pane is muted.
    list.push(willGet.length
      ? { text: 'broadcast  to every claude pane',
          hint: `${willGet.length} of ${claudePanes.length}`,
          ask: `what to send to ${willGet.length} pane${willGet.length === 1 ? '' : 's'}`,
          run: broadcast }
      : { text: 'broadcast  — every claude pane is muted',
          hint: `0 of ${claudePanes.length}`,
          run: () => flash(`unmute a pane first — all ${claudePanes.length} are muted`) });
  }
  for (const t of claudePanes) {
    list.push({ text: `send  to #${t.id} ${t.label || t.profile}`, hint: t.cwd || '',
                ask: `what to send to #${t.id}`, run: text => sendTo(t.id, text) });
  }
  list.push({ text: 'timeline  all sessions in order', hint: 'ctrl+shift+M', run: () => openTimeline() });
  if (focused) list.push({ text: `timeline  pane #${focused} only`, run: () => openTimeline(focused) });
  list.push({ text: 'jump to what needs me', hint: 'ctrl+shift+space', run: jumpToNeedy });
  list.push({ text: 'plain english  this pane', hint: 'ctrl+shift+E', run: () => { const p = panes.get(focused); if (p) setMode(p, !p.sem); } });
  list.push({ text: 'plain english  every pane', hint: 'ctrl+shift+A', run: toggleAllModes });
  const fp = panes.get(focused);
  if (fp && !fp.alive) {
    list.push({ text: `restart  #${fp.id} ${fp.label || fp.profile}`, hint: 'session ended',
                run: () => restartPane(fp.id) });
  }
  for (const d of panes.values()) {
    if (d.alive || d.id === focused) continue;
    list.push({ text: `restart  #${d.id} ${d.label || d.profile}`, hint: 'session ended',
                run: () => restartPane(d.id) });
  }
  list.push({ text: 'settings  edit the thresholds', hint: SETTINGS_SOURCE, run: openSettingsFile });
  list.push({ text: 'about  version and where things live', run: showAbout });
  if (fp && fp.profile === 'claude') {
    list.push({ text: fp.muted ? `unmute  #${fp.id} for broadcast` : `mute  #${fp.id} from broadcast`,
                hint: fp.muted ? 'currently muted' : '',
                run: () => {
                  fp.muted = !fp.muted;
                  fp.el.classList.toggle('muted', fp.muted);
                  flash(`#${fp.id} ${fp.muted ? 'muted' : 'unmuted'}`);
                } });
  }
  list.push({ text: layout === 'stage' ? 'grid  tile every pane' : 'stage  one pane at reading size',
              hint: 'ctrl+shift+G', run: () => setLayout(layout === 'stage' ? 'grid' : 'stage') });
  list.push({ text: 'zoom this pane', hint: 'ctrl+shift+Z', run: toggleZoom });
  if (focused) list.push({ text: `close pane #${focused}`, hint: 'ctrl+shift+W', run: () => closePane(focused) });
  return list;
}

let paletteOpen = false, paletteSel = 0, paletteRows = [], asking = null;

function openPalette() {
  paletteOpen = true;
  asking = null;
  paletteSel = 0;
  const el = document.getElementById('palette');
  el.classList.add('open');
  const input = document.getElementById('pal-input');
  input.value = '';
  input.placeholder = 'run a swarm, open a pane, find anything…';
  filterPalette();
  input.focus();
}

function closePalette() {
  paletteOpen = false;
  asking = null;
  document.getElementById('palette').classList.remove('open');
  if (!timelineOpen) panes.get(focused)?.term.focus();
}

function filterPalette() {
  const q = document.getElementById('pal-input').value.trim();
  const box = document.getElementById('pal-list');
  box.textContent = '';

  if (asking) {                    // capturing a name, not choosing an action
    box.innerHTML = `<div class="pal-ask">${asking.hint}</div>`;
    paletteRows = [];
    return;
  }

  paletteRows = actions()
    .map(a => ({ a, s: score(a.text, q) }))
    .filter(r => Number.isFinite(r.s))
    .sort((x, y) => y.s - x.s)
    .map(r => r.a);

  if (paletteSel >= paletteRows.length) paletteSel = Math.max(0, paletteRows.length - 1);

  paletteRows.forEach((a, i) => {
    const d = document.createElement('div');
    d.className = 'pal-row' + (i === paletteSel ? ' sel' : '');
    const t = document.createElement('span'); t.className = 'pal-text'; t.textContent = a.text;
    const h = document.createElement('span'); h.className = 'pal-hint'; h.textContent = a.hint || '';
    d.append(t, h);
    d.addEventListener('mousedown', e => { e.preventDefault(); paletteSel = i; runPaletteSelection(); });
    box.appendChild(d);
  });
}

function runPaletteSelection() {
  const input = document.getElementById('pal-input');

  if (asking) {                    // second step: the name was typed
    const value = input.value.trim();
    if (!value) return;
    const fn = asking.run;
    closePalette();
    fn(value);
    return;
  }

  const a = paletteRows[paletteSel];
  if (!a) return;
  if (a.ask) {                     // this action needs a word from you first
    asking = { hint: a.ask, run: a.run };
    input.value = '';
    input.placeholder = a.ask;
    filterPalette();
    return;
  }
  closePalette();
  a.run();
}

function movePalette(d) {
  if (!paletteRows.length) return;
  paletteSel = (paletteSel + d + paletteRows.length) % paletteRows.length;
  filterPalette();
}

const toggleAllModes = () => {
  const on = ![...panes.values()].every(p => p.sem);
  panes.forEach(p => setMode(p, on));
};

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

/** One lamp per pane, in pane order — the whole cockpit as a single row.
 *  Rebuilt only when the shape or the states actually change, so a 500ms tick
 *  is not rewriting DOM for nothing. */
let musterKey = '';
function renderMuster() {
  const rail = document.getElementById('muster');
  if (!rail) return;
  const states = [...panes.values()].map(p => p.state?.key || 'idle');
  const key = states.join(',');
  if (key === musterKey) return;
  musterKey = key;

  rail.textContent = '';
  for (const p of panes.values()) {
    const lamp = document.createElement('span');
    lamp.className = 'lamp';
    lamp.dataset.state = p.state?.key || 'idle';
    lamp.title = `#${p.id} ${p.label || p.profile} — ${p.state?.label || ''}`;
    lamp.addEventListener('click', () => focus(p.id));
    rail.appendChild(lamp);
  }
}

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
    if (p.burst < SETTINGS.burst_floor) p.quietSince ||= now;
    else p.quietSince = 0;

    const s = paneState(p, now, SETTINGS);
    const changed = s.key !== p.state?.key;
    p.state = s;
    p.el.dataset.state = s.key;
    p.stateEl.textContent = s.since > 1500 ? `${s.label} · ${fmt(s.since)}` : s.label;
    if (p.el.classList.contains('carded') && p.peekEl.textContent !== p.lastLine) {
      p.peekEl.textContent = p.lastLine;
    }
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

  // The muster rail: one lamp per pane, in pane order. With nine sessions this
  // is the difference between reading the room and auditing nine headers.
  renderMuster();

  const bits = [];
  if (needs) bits.push(`${needs} waiting`);
  if (working) bits.push(`${working} running`);
  tally.textContent = bits.join('  ');
  tally.classList.toggle('alert', needs > 0);

  // The title is the only part of the cockpit visible when AgentSwarm is not the
  // window you are looking at — which is the whole problem. It always carries the
  // session count, so a glance at the taskbar is never ambiguous about whether
  // the app is reporting or merely sitting there.
  const n = panes.size;
  // Reads as a readout, not a plea. No bullet shouting for attention in the
  // taskbar — the count is the information, and a number is enough.
  const title = needs
    ? `AgentSwarm · ${needs} waiting`
    : n ? `AgentSwarm · ${n} session${n > 1 ? 's' : ''}` : 'AgentSwarm';
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

  addToFeed(c, p);

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

  // In time order, not arrival order — the same rule the merged timeline follows.
  // These two views showed the same three cards in different orders until this
  // was fixed, and the case is not hypothetical: when the watcher switches from
  // borrowed context to this pane's own session it replays that session from the
  // start, so late-arriving cards are routinely older than what is already here.
  d.dataset.at = c.at;
  const kids = p.cards.children;
  let i = kids.length;
  while (i > 0 && Number(kids[i - 1].dataset.at) > c.at) i--;
  p.cards.insertBefore(d, kids[i] || null);

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
  // In stage the focused pane IS the layout, so focusing is a layout change.
  if (stageActive()) relayout();
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
  rememberLayout();
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
  rememberLastLine(p, e.payload.data);
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
      // Amber, not red, and stated rather than confessed. Red is for something
      // broken; this is a condition worth knowing about, and the difference
      // between the two is most of what made the app feel anxious.
      p.term.writeln('\r\n\x1b[33m' + p.profile + ' started but has produced no output.\x1b[0m');
      p.term.writeln('\x1b[90mthe process is running — nothing has been written to this pane yet.\x1b[0m');
    }
  });
}, 1000);

/* Overlay wiring. The palette owns its own keys while it is open, so arrows and
   enter mean "choose" rather than reaching the terminal underneath. */
{
  const input = document.getElementById('pal-input');
  input.addEventListener('input', () => { paletteSel = 0; filterPalette(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runPaletteSelection(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    e.stopPropagation();
  });
  document.getElementById('palette').addEventListener('mousedown', e => {
    if (e.target.id === 'palette') closePalette();   // clicking outside dismisses
  });
  document.querySelector('.tl-close').addEventListener('click', closeTimeline);
  document.querySelector('.sh-close').addEventListener('click', closeSheet);
  document.getElementById('sheet').addEventListener('mousedown', e => {
    if (e.target.id === 'sheet') closeSheet();
  });
  document.getElementById('timeline').addEventListener('mousedown', e => {
    if (e.target.id === 'timeline') closeTimeline();
  });
}

addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (paletteOpen) { e.preventDefault(); closePalette(); return; }
    if (timelineOpen) { e.preventDefault(); closeTimeline(); return; }
    if (sheetOpen) { e.preventDefault(); closeSheet(); return; }
  }
  if (!(e.ctrlKey && e.shiftKey)) return;
  const k = e.key.toLowerCase();
  const hit = () => { e.preventDefault(); e.stopPropagation(); };
  if (k === 't') { hit(); newPane(defaultProfile); }
  else if (k === 'w') { hit(); if (focused) closePane(focused); }
  else if (k === 'z') { hit(); toggleZoom(); }
  else if (k === 'e') { hit(); const p = panes.get(focused); if (p) setMode(p, !p.sem); }
  else if (e.key === ' ') { hit(); jumpToNeedy(); }
  else if (k === 'p') { hit(); paletteOpen ? closePalette() : openPalette(); }
  else if (k === 'm') { hit(); timelineOpen ? closeTimeline() : openTimeline(); }
  else if (k === 'd') { hit(); sheetOpen && sheetKind === 'diff' ? closeSheet() : showChanges(); }
  else if (k === 'f') { hit(); sheetOpen && sheetKind === 'search' ? closeSheet() : showSearch(); }
  else if (k === 'g') { hit(); setLayout(layout === 'stage' ? 'grid' : 'stage'); }
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
  // cwd first: custom profiles live in that folder's settings, so asking what
  // this machine can run means nothing until we know where we are.
  try { workdir = await invoke('default_cwd'); } catch { /* panes inherit instead */ }
  try { profiles = await invoke('available_profiles', { cwd: workdir }); } catch { /* keep the default */ }
  if (profiles.includes('claude')) defaultProfile = 'claude';
  await loadSettings();
  // A first run finds no recipes, so the palette's headline feature looks empty
  // and the app appears to do less than it does. A starter file also teaches the
  // format better than documentation would.
  try {
    const seeded = await invoke('seed_first_run', { cwd: workdir });
    if (seeded) { diag(`first run — wrote a starter recipe to ${seeded}`); flash('first run — starter swarm written'); }
  } catch (e) { diag(`seed failed: ${e}`); }
  await refreshRecipes();

  const bar = document.getElementById('profiles');
  for (const name of profiles) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => newPane(name));
    bar.appendChild(b);
  }

  relayout();

  // `agentswarm --swarm morning` opens the whole arrangement and nothing else.
  // A named swarm that does not exist must say so — starting a lone default pane
  // as if nothing were asked for is how a typo turns into a confusing morning.
  let wanted = null;
  try { wanted = await invoke('startup_swarm'); } catch { /* no flag, no problem */ }
  if (wanted) {
    const r = recipes.find(x => x.name === wanted);
    if (r) { await runRecipe(r); await maybeDemo(); return; }
    flash(`no swarm named "${wanted}"`);
    diag(`--swarm "${wanted}" not found; opening a default pane instead`);
  }

  // M7 — reopen what was open. A daily driver that forgets its arrangement every
  // morning is not a daily driver. Announced rather than silent, and skippable
  // with --fresh, because a restore nobody asked for is a surprise.
  const fresh = new URLSearchParams(location.search).has('fresh') ||
                (await invoke('startup_swarm').catch(() => null)) === 'fresh';
  if (SETTINGS.restore_layout && !fresh) {
    let last = [];
    try { last = await invoke('load_layout', { cwd: workdir }); } catch { /* first run */ }
    if (last.length) {
      diag(`reopening ${last.length} pane(s) from last time`);
      for (const spec of last) {
        await newPane(spec.profile, { cwd: spec.cwd, args: spec.args, label: spec.label });
      }
      flash(`reopened ${last.length} pane${last.length > 1 ? 's' : ''} from last time`);
      await maybeDemo();
      return;
    }
  }
  newPane(defaultProfile);
  await maybeDemo();
})();

/** --demo: hand the app's own controls to a script, so a recording shows the
 *  product working rather than a window that opened. */
async function maybeDemo() {
  let on = false;
  try { on = await invoke('demo_requested'); } catch { /* not a demo run */ }
  if (!on) return;
  await new Promise(r => setTimeout(r, 2500));   // let panes finish spawning
  await runDemo({
    flash, diag, setLayout, openTimeline, closeTimeline, openPalette,
    closePalette, showChanges, closeSheet, setMode, panes, focus, sendTo,
  });
}
