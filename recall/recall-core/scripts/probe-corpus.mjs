// Run the organs against the real corpus.
//
// Fixtures prove the parser handles the shapes we thought of. This proves it
// survives 700 MB of the shapes we did not. It reports the two numbers that
// decide whether Recall's claim is buildable at all:
//
//   1. how many commits can be cited with certainty (the SHA half of the claim)
//   2. how much of the corpus is duplicate replay (the cost of backfill)
//
// Read-only. Writes nothing, calls no LLM, sends nothing anywhere.

import {
  listTranscripts, readMessages, dedupeMessages,
  authoredCommits, locate, verifyExcerpt, redact,
} from '../src/index.js';

const LIMIT = Number(process.argv[2] || 120);

const files = listTranscripts().slice(0, LIMIT);
let messages = 0, prose = 0, dropped = 0, commits = 0, sessions = 0;
let excerptChecked = 0, excerptOk = 0, redactedHits = 0;
const seen = new Set();
const examples = [];

const t0 = Date.now();
for (const f of files) {
  sessions++;
  let msgs;
  try {
    msgs = [...readMessages(f.file)];
  } catch (e) {
    console.error('unreadable', f.file, e.message);
    continue;
  }
  messages += msgs.length;

  const before = msgs.length;
  const kept = dedupeMessages(msgs, seen);
  dropped += before - kept.length;
  prose += kept.filter((m) => m.text).length;

  const found = authoredCommits(msgs);
  commits += found.length;

  for (const c of found.slice(0, 1)) {
    const src = msgs.find((m) => m.uuid === c.messageUuid);
    if (!src) continue;
    // Prove a receipt round-trips: cut it, hash it, verify it.
    const loc = locate(src, { match: c.sha });
    excerptChecked++;
    if (verifyExcerpt(loc, loc.excerpt)) excerptOk++;
    if (examples.length < 6) {
      examples.push({
        sha: c.sha, branch: c.branch, cwd: c.cwd, repo: c.repo,
        moved: c.repo !== c.cwd,
        cmd: c.command.replace(/\s+/g, ' ').slice(0, 54),
      });
    }
  }

  for (const m of kept) {
    if (m.text && redact(m.text) !== m.text) redactedHits++;
  }
}
const ms = Date.now() - t0;

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0');
console.log(`corpus probe — ${sessions} transcripts in ${(ms / 1000).toFixed(1)}s`);
console.log(`  messages parsed        ${messages}`);
console.log(`  duplicate replay       ${dropped}  (${pct(dropped, messages)}% — resumed/compacted sessions)`);
console.log(`  messages with prose    ${prose}`);
console.log(`  commits CITABLE        ${commits}  (authored in-session, SHA parsed from tool output)`);
console.log(`  sessions w/ a commit   ~${examples.length ? 'yes' : 'none'}`);
console.log(`  receipt round-trip     ${excerptOk}/${excerptChecked} verified`);
console.log(`  messages needing redaction ${redactedHits}`);
console.log('\n  sample citable commits:');
for (const e of examples) {
  const flag = e.moved ? '  ← session cwd was ' + e.cwd : '';
  console.log(`    ${e.sha}  [${e.branch}]  repo: ${e.repo}${flag}`);
  console.log(`        <- ${e.cmd}`);
}
