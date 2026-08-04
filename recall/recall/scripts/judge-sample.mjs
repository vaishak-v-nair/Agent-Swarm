// Run the judge over a SAMPLE of real candidates and report what came back.
//
// Deliberately a sample, not a backfill. The probe's quality gate is ">=50
// sampled cards manually verified, >=90% precision on anything shown as a
// receipt" — so the first run's job is to produce cards a human can read and
// judge, cheaply, before any money goes into indexing six months of history.
//
//   node scripts/judge-sample.mjs [candidates] [batchSize]
//
// Prints every card in full, plus rejection reasons and measured cost.

import { listTranscripts, readMessages, dedupeMessages, authoredCommits, joinCommit, locate }
  from '../../recall-core/src/index.js';
import { candidatesFrom, toPrompt } from '../src/candidates.js';
import { judgeBatch } from '../src/judge.js';
import { autoClient } from '../src/clients.js';

const WANT = Number(process.argv[2] || 24);
const BATCH = Number(process.argv[3] || 6);

// ---- gather candidates, newest sessions first ---------------------------
const seen = new Set();
const picked = [];
const commitsBySession = new Map();

for (const f of listTranscripts()) {
  if (picked.length >= WANT) break;
  let msgs;
  try { msgs = [...readMessages(f.file)]; } catch { continue; }
  const kept = dedupeMessages(msgs, seen);
  const cands = candidatesFrom(kept);
  if (!cands.length) continue;
  commitsBySession.set(cands[0].sessionId, authoredCommits(msgs));
  // Spread across sessions rather than draining one: a sample from a single
  // session would flatter the judge and tell us nothing about breadth.
  for (const c of cands.slice(0, 4)) {
    if (picked.length >= WANT) break;
    picked.push({ c, byUuid: new Map(kept.map((m) => [m.uuid, m])) });
  }
}

const client = autoClient();
console.log(`judging ${picked.length} candidates via ${client.label}, batches of ${BATCH}\n`);

const cards = [];
const rejected = [];
const errors = [];
const t0 = Date.now();

for (let i = 0; i < picked.length; i += BATCH) {
  const slice = picked.slice(i, i + BATCH);
  process.stdout.write(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(picked.length / BATCH)} … `);
  const out = await judgeBatch(slice.map((p) => p.c), client, { toPrompt });
  cards.push(...out.cards);
  rejected.push(...out.rejected);
  errors.push(...out.errors);
  console.log(`${out.cards.length} cards, ${out.rejected.length} rejected`);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

// ---- attach the second locator ------------------------------------------
for (const card of cards) {
  const commits = commitsBySession.get(card.sessionId) || [];
  const join = joinCommit(commits, Date.parse(card.timestamp));
  card.commit = join;                       // may be null — transcript-only is fine
  const src = (picked.find((p) => p.c.messageUuid === card.messageUuid) || {}).byUuid;
  const msg = src && src.get(card.messageUuid);
  if (msg) card.receipt = locate(msg, { match: card.quote });
}

// ---- report --------------------------------------------------------------
console.log(`\n${'='.repeat(72)}\nCARDS (${cards.length})\n${'='.repeat(72)}`);
for (const c of cards) {
  console.log(`\n[${c.type}] ${c.title}`);
  console.log(`  ${c.body}`);
  console.log(`  certainty: ${c.certainty}   via: ${c.generator}`);
  console.log(`  quote: "${c.quote.slice(0, 150)}${c.quote.length > 150 ? '…' : ''}"`);
  console.log(`  receipt: session ${c.sessionId.slice(0, 8)} · msg ${String(c.messageUuid).slice(0, 8)}` +
    (c.receipt ? ` · ${c.receipt.excerptHash.slice(0, 14)}…` : ''));
  console.log(`  commit:  ${c.commit ? `${c.commit.sha} (${c.commit.confidence})` : 'transcript-only'}`);
  console.log(`  where:   ${c.cwd}`);
}

const reasons = {};
for (const r of rejected) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
console.log(`\n${'='.repeat(72)}\nREJECTED (${rejected.length})`);
for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ${v}x  ${k}`);

// Every quote the gate refused, verbatim. This is how a fabricating model is
// told apart from an over-strict gate — read them and see which it is.
const faith = rejected.filter((r) => r.attemptedQuote);
if (faith.length) {
  console.log(`\n  quotes the faithfulness gate refused (${faith.length}):`);
  for (const r of faith) console.log(`    · "${r.attemptedQuote}"`);
}
const mis = rejected.filter((r) => r.actualOwner);
if (mis.length) {
  console.log(`
  MISATTRIBUTED — real quotes filed under the wrong id (${mis.length}):`);
  for (const r of mis) console.log(`    · ${r.id.slice(0,8)} <- actually ${r.actualOwner.slice(0,8)}`);
}
if (errors.length) console.log('\nERRORS:', errors);

const withCommit = cards.filter((c) => c.commit).length;
const types = {};
for (const c of cards) types[c.type] = (types[c.type] || 0) + 1;

console.log(`\n${'='.repeat(72)}\nSUMMARY`);
console.log(`  judged        ${picked.length} in ${secs}s`);
console.log(`  cards         ${cards.length}  (${((cards.length / picked.length) * 100).toFixed(0)}% accept)`);
console.log(`  by type       ${Object.entries(types).map(([k, v]) => `${k}:${v}`).join('  ') || '—'}`);
console.log(`  both locators ${withCommit}/${cards.length} carry a commit; the rest ship transcript-only`);
const u = client.usage || {};
if (u.costUsd) console.log(`  cost          $${u.costUsd.toFixed(4)} over ${u.calls} calls`);
else if (u.inputTokens) console.log(`  tokens        ${u.inputTokens} in / ${u.outputTokens} out over ${u.calls} calls`);
