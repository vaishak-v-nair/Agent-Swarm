import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

const grid = document.getElementById('grid');
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
  queueMicrotask(fitAll);
}

const fitAll = () => panes.forEach(p => refit(p));

function refit(p) {
  try {
    p.fit.fit();
    invoke('pty_resize', { id: p.id, cols: p.term.cols, rows: p.term.rows });
  } catch { /* pane not laid out yet */ }
}

/* ── panes ─────────────────────────────────────────────────────────────── */
async function newPane(profile = 'powershell') {
  const id = nextId++;

  const el = document.createElement('div');
  el.className = 'pane';
  el.innerHTML =
    `<div class="head"><span class="dot"></span><span class="name">${profile}</span>` +
    `<span class="id">#${id}</span><span class="x" title="close">✕</span></div>` +
    `<div class="term"></div>`;
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

  const p = { id, term, fit, el, profile, alive: true, dot: el.querySelector('.dot') };
  panes.set(id, p);

  // Input goes straight out. It never waits on rendering or on the reader
  // thread, which is what keeps typing instant while agents flood output.
  term.onData(data => invoke('pty_write', { id, data }));
  el.addEventListener('mousedown', () => focus(id));
  el.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); closePane(id); });

  relayout();
  focus(id);
  refit(p);

  try {
    await invoke('pty_spawn', {
      id, profile,
      cwd: null,
      cols: term.cols || 80,
      rows: term.rows || 24,
    });
  } catch (e) {
    term.writeln(`\r\n\x1b[31mfailed to start ${profile}: ${e}\x1b[0m`);
    markDead(id);
  }
}

function focus(id) {
  const p = panes.get(id);
  if (!p) return;
  focused = id;
  panes.forEach(q => q.el.classList.toggle('focus', q.id === id));
  p.term.focus();
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
  queueMicrotask(fitAll);
}

function cycle(dir) {
  const ids = [...panes.keys()];
  if (!ids.length) return;
  const i = ids.indexOf(focused);
  focus(ids[(i + dir + ids.length) % ids.length]);
}

/* ── wiring ────────────────────────────────────────────────────────────── */
listen('pty:data', e => panes.get(e.payload.id)?.term.write(e.payload.data));
listen('pty:exit', e => {
  markDead(e.payload.id);
  panes.get(e.payload.id)?.term.writeln('\r\n\x1b[90m[session ended]\x1b[0m');
});

addEventListener('keydown', e => {
  if (!(e.ctrlKey && e.shiftKey)) return;
  const k = e.key.toLowerCase();
  const hit = () => { e.preventDefault(); e.stopPropagation(); };
  if (k === 't') { hit(); newPane(defaultProfile); }
  else if (k === 'w') { hit(); if (focused) closePane(focused); }
  else if (k === 'z') { hit(); toggleZoom(); }
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

(async () => {
  let profiles = ['powershell'];
  try { profiles = await invoke('available_profiles'); } catch { /* keep the default */ }
  if (profiles.includes('claude')) defaultProfile = 'claude';

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
