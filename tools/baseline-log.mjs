#!/usr/bin/env node
// One-command logger for the AgentSwarm baseline week.
// The week's whole value depends on logging within ~5 minutes of noticing.
// Anything slower than "type one line" loses entries, so this is the whole tool.
//
//   log A glance   waited ~12 min on a permission prompt, didn't notice
//   log C          had to scroll back to see what the auth session actually did
//   log R          three diffs piled up, couldn't tell which needed me first
//   log lag        typing stuttered badly in the third terminal
//   log            → show today's entries and the running tally
//   log tally      → full week tally against the locked thresholds

import fs from 'node:fs';

const FILE = 'E:/agent-swarm/AgentSwarm intelligence/03 Plans/P7 - Baseline Log (fill daily).md';
const NOTICED = ['glance', 'toast', 'timer', 'phone', 'tray', 'other'];
const TAGS = { a: 'A', c: 'C', r: 'R', lag: 'lag' };
const THRESHOLD = { A: 2, C: 3, R: 3 };
const LABEL = {
  A: 'attention — waited, unnoticed',
  C: 'comprehension — had to scroll to understand',
  R: 'review — backlog / triage pain',
  lag: 'lag (excluded from all counts)',
};

const read = () => fs.readFileSync(FILE, 'utf8');
const entries = (md) =>
  [...md.matchAll(/^- (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · \[(A|C|R|lag)\]([^\n]*)/gm)]
    .map(m => ({ date: m[1], time: m[2], tag: m[3], rest: m[4] }));

function tally(md, { full = false } = {}) {
  const all = entries(md);
  const days = [...new Set(all.map(e => e.date))].sort();
  const today = new Date().toISOString().slice(0, 10);

  if (!full) {
    const mine = all.filter(e => e.date === today);
    console.log(`\n  today (${today}) — ${mine.length} logged`);
    mine.forEach(e => console.log(`    ${e.time} [${e.tag}]${e.rest}`));
    if (!mine.length) console.log('    (nothing yet)');
  }

  console.log(`\n  week so far — day ${days.length} of 5\n`);
  for (const t of ['A', 'C', 'R']) {
    const n = all.filter(e => e.tag === t).length;
    const hit = n >= THRESHOLD[t];
    console.log(`    ${t}  ${String(n).padStart(2)} / ${THRESHOLD[t]}  ${hit ? '✅ PASSES' : '— not yet'}   ${LABEL[t]}`);
  }
  const lag = all.filter(e => e.tag === 'lag').length;
  if (lag) console.log(`    lag ${String(lag).padStart(2)}        (excluded by rule)`);

  if (days.length >= 5) {
    const none = ['A', 'C', 'R'].every(t => all.filter(e => e.tag === t).length < THRESHOLD[t]);
    console.log(none
      ? '\n  ⚠️  5 days logged and no gate passed → this is the STOP outcome.\n      Write the closure note. Build nothing. That is a real result.'
      : '\n  5 days logged — take the tally to the Tournament Week note and fill the verdict.');
  }
  console.log('');
}

const argv = process.argv.slice(2);
const md = read();

if (!argv.length) { tally(md); process.exit(0); }
if (argv[0] === 'tally') { tally(md, { full: true }); process.exit(0); }

const tag = TAGS[argv[0].toLowerCase()];
if (!tag) {
  console.log(`\n  unknown tag "${argv[0]}" — use A, C, R, or lag\n`);
  console.log('  A   ' + LABEL.A);
  console.log('  C   ' + LABEL.C);
  console.log('  R   ' + LABEL.R);
  console.log('  lag ' + LABEL.lag + '\n');
  process.exit(1);
}

let rest = argv.slice(1);
let noticed = '';
if (tag === 'A' && rest.length && NOTICED.includes(rest[0].toLowerCase())) {
  noticed = rest.shift().toLowerCase();
}
const text = rest.join(' ').trim();
if (!text) { console.log('\n  say what happened:  log A glance waited 12 min unnoticed\n'); process.exit(1); }

const now = new Date();
const date = now.toISOString().slice(0, 10);
const time = now.toTimeString().slice(0, 5);
const line = `- ${date} ${time} · [${tag}]${noticed ? ` · noticed-by: ${noticed}` : ''} · ${text}`;

// insert under a per-date heading inside the log section, creating the day if new
const MARK = '<!-- entries -->';
let out = md;
if (!out.includes(MARK)) {
  console.log(`\n  the log file has no ${MARK} marker — not writing. Check the file.\n`);
  process.exit(1);
}
const dayHead = `### ${date}`;
if (out.includes(dayHead)) {
  // append at the end of that day's block
  const i = out.indexOf(dayHead);
  const next = out.indexOf('\n### ', i + 1);
  const end = next === -1 ? out.indexOf('\n## ', i + 1) : next;
  const cut = end === -1 ? out.length : end;
  out = out.slice(0, cut).replace(/\s*$/, '') + '\n' + line + '\n' + out.slice(cut);
} else {
  out = out.replace(MARK, `${MARK}\n\n${dayHead}\n\n${line}`);
}
fs.writeFileSync(FILE, out);

console.log(`\n  logged  ${time}  [${tag}]${noticed ? ' · ' + noticed : ''}  ${text}`);
tally(fs.readFileSync(FILE, 'utf8'));
