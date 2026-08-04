// How many candidates does the real corpus yield, and what would judging cost?
//
// The design gives extraction a budget line and calls backfill "potentially
// tens of dollars". That was an estimate. This measures it.
//
// Read-only: no LLM call, no writes, nothing leaves the machine.

import { listTranscripts, readMessages, dedupeMessages } from '../../recall-core/src/index.js';
import { candidatesFrom, toPrompt } from '../src/candidates.js';

const LIMIT = Number(process.argv[2] || 101);

const files = listTranscripts().slice(0, LIMIT);
const seen = new Set();
let sessions = 0, messages = 0, deduped = 0;
let promptChars = 0;
const byGen = { 'error-retry': 0, vocabulary: 0 };
const byHint = { gotcha: 0, decision: 0, abandonment: 0, none: 0 };
const perSession = [];
const t0 = Date.now();

for (const f of files) {
  sessions++;
  let msgs;
  try { msgs = [...readMessages(f.file)]; } catch { continue; }
  messages += msgs.length;
  const kept = dedupeMessages(msgs, seen);
  deduped += msgs.length - kept.length;

  const cands = candidatesFrom(kept);
  perSession.push(cands.length);
  for (const c of cands) {
    byGen[c.generator]++;
    if (!c.hints.length) byHint.none++;
    for (const h of c.hints) byHint[h]++;
    promptChars += toPrompt(c).text.length;
  }
}

const total = byGen['error-retry'] + byGen.vocabulary;
const ms = Date.now() - t0;
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0');

// Haiku-class pricing, input-dominated. ~4 chars/token.
const inTok = Math.round(promptChars / 4);
const outTok = total * 220;                 // a card is small
const cost = (inTok / 1e6) * 1.0 + (outTok / 1e6) * 5.0;

console.log(`candidate generation — ${sessions} transcripts in ${(ms / 1000).toFixed(1)}s\n`);
console.log(`  messages parsed         ${messages}`);
console.log(`  duplicate replay        ${deduped} (${pct(deduped, messages)}%)`);
console.log(`  CANDIDATES              ${total}   (${(total / sessions).toFixed(1)} per session)`);
console.log(`    error-retry           ${byGen['error-retry']}  (${pct(byGen['error-retry'], total)}%)`);
console.log(`    vocabulary            ${byGen.vocabulary}  (${pct(byGen.vocabulary, total)}%)`);
console.log(`\n  vocabulary hints (hints, NOT verdicts):`);
console.log(`    gotcha                ${byHint.gotcha}`);
console.log(`    decision              ${byHint.decision}`);
console.log(`    abandonment           ${byHint.abandonment}`);
console.log(`    none (keyword-free)   ${byHint.none}  (${pct(byHint.none, total)}%)  <- invisible to a regex-only extractor`);
console.log(`\n  judging cost, one full backfill:`);
console.log(`    input  ~${(inTok / 1000).toFixed(0)}k tokens`);
console.log(`    output ~${(outTok / 1000).toFixed(0)}k tokens`);
console.log(`    ~$${cost.toFixed(2)} at Haiku-class rates`);
console.log(`\n  at the probe's measured 51% yield -> ~${Math.round(total * 0.51)} cards, ~${Math.round(total * 0.37)} demo-grade`);
