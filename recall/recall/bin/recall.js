#!/usr/bin/env node
// recall — answer with receipts.
//
//   recall index [--limit N] [--batch N] [--dry]   build the store from transcripts
//   recall "why did the credential helper hang?"   answer, with receipts
//   recall --grep "credential helper"              retrieval only: free, instant
//   recall why <card-id>                           the receipt chain for one card
//   recall stats                                   what is indexed, what it cost
//   recall backup [path]                           VACUUM INTO a safe copy
//
// Everything is local except the extraction and synthesis calls.

import process from 'node:process';
import path from 'node:path';
import os from 'node:os';
import {
  listTranscripts, readMessages, dedupeMessages, authoredCommits, joinCommit, locate,
} from '../../recall-core/src/index.js';
import { candidatesFrom, toPrompt } from '../src/candidates.js';
import { judgeBatch, PROMPT_VERSION, JUDGE_SCHEMA } from '../src/judge.js';
import { resolveClient, readConfig, writeConfig, PRESETS, listOllamaModels, ollamaUp, CONFIG_PATH, judgeCapability } from '../src/providers.js';
import { openStore, defaultStorePath } from '../src/store.js';
import { answer } from '../src/answer.js';

const argv = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = argv.indexOf(name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const has = (name) => argv.includes(name);

const C = process.stdout.isTTY
  ? { dim: '\x1b[2m', b: '\x1b[1m', amber: '\x1b[33m', green: '\x1b[32m', blue: '\x1b[36m', off: '\x1b[0m' }
  : { dim: '', b: '', amber: '', green: '', blue: '', off: '' };

const cmd = argv.find((a) => !a.startsWith('--')) || '';

if (has('--help') || (!cmd && !has('--grep'))) {
  console.log(`recall — answer with receipts

  recall index [--limit N] [--batch N] [--dry]
  recall "your question"
  recall --grep "terms"          retrieval only, no LLM, free
  recall why <card-id>
  recall stats
  recall doctor [--repair]
  recall config [--provider X --key K --model M]
  recall backup [path]

store:    ${defaultStorePath()}
provider: run \`recall config\` to see options (ollama is free)`);
  process.exit(0);
}

// --------------------------------------------------------------- config
// Runs before the store opens: choosing a backend should not need a database.
if (cmd === 'config') {
  const provider = flag('--provider');
  const key = flag('--key');
  const model = flag('--model');
  const baseUrl = flag('--base-url');

  if (!provider && !key && !model && !baseUrl) {
    const cfg = readConfig();
    console.log(`${C.b}provider${C.off}  ${cfg.provider || `${C.dim}(auto)${C.off}`}`);
    if (cfg.model) console.log(`${C.b}model${C.off}     ${cfg.model}`);
    if (cfg.baseUrl) console.log(`${C.b}base url${C.off}  ${cfg.baseUrl}`);
    console.log(`${C.b}key${C.off}       ${cfg.apiKey ? `${C.green}set${C.off} (…${String(cfg.apiKey).slice(-4)})` : `${C.dim}none${C.off}`}`);

    const up = await ollamaUp();
    console.log(`\n${C.b}local${C.off}     ollama ${up ? `${C.green}running${C.off}` : `${C.dim}not running${C.off}`}`);
    if (up) for (const m of await listOllamaModels()) {
      console.log(`  ${C.green}free${C.off}  ${m.name}  ${(m.size / 1024 ** 3).toFixed(1)} GB`);
    }
    console.log(`\n${C.b}presets${C.off}`);
    for (const [n, p] of Object.entries(PRESETS)) {
      console.log(`  ${n.padEnd(11)} ${p.free ? `${C.green}free${C.off}  ` : '      '}${p.model}`);
    }
    console.log(`  ${'anthropic'.padEnd(11)}       separate API billing — does NOT touch the subscription`);
    console.log(`  ${'claude-cli'.padEnd(11)}       ${C.amber}spends the Claude subscription${C.off}`);
    console.log(`\n${C.dim}recall config --provider ollama${C.off}`);
    console.log(`${C.dim}recall config --provider groq --key gsk_…${C.off}`);
    process.exit(0);
  }

  const patch = {};
  if (typeof provider === 'string') patch.provider = provider;
  if (typeof key === 'string') patch.apiKey = key;
  if (typeof model === 'string') patch.model = model;
  if (typeof baseUrl === 'string') patch.baseUrl = baseUrl;
  writeConfig(patch);
  console.log(`${C.green}saved${C.off} ${CONFIG_PATH}`);
  for (const [k, v] of Object.entries(patch)) {
    console.log(`  ${k} = ${k === 'apiKey' ? `…${String(v).slice(-4)}` : v}`);
  }
  process.exit(0);
}

const store = openStore(flag('--store') === true ? defaultStorePath() : flag('--store') || defaultStorePath());

// --------------------------------------------------------------- index
if (cmd === 'index') {
  const limit = Number(flag('--limit', 40));
  const batch = Number(flag('--batch', 5));
  const dry = has('--dry');
  const client = dry ? null : await resolveClient({ schema: JUDGE_SCHEMA });

  console.log(`${C.b}indexing${C.off} up to ${limit} transcripts` +
    `${dry ? ' (dry run — no LLM, no cost)' : ` via ${client.label}`}\n`);

  // Say it BEFORE the run, not after an overnight one has produced nothing.
  if (client) {
    const cap = judgeCapability(client.label);
    if (!cap.ok) {
      console.log(`${C.amber}${C.b}warning${C.off}  ${cap.why}`);
      console.log(`         ${cap.fix}`);
      if (!has('--force')) {
        console.log(`\n${C.dim}re-run with --force to try it anyway${C.off}`);
        store.close();
        process.exit(1);
      }
      console.log('');
    }
  }

  const seen = new Set();
  let totalCands = 0, totalCards = 0, totalRej = 0, skipped = 0;

  for (const f of listTranscripts().slice(0, limit)) {
    let msgs;
    try { msgs = [...readMessages(f.file)]; } catch { continue; }
    const kept = dedupeMessages(msgs, seen);
    const cands = candidatesFrom(kept);
    if (!cands.length) continue;

    const sessionId = cands[0].sessionId;
    // The ledger makes re-running free: work already paid for is skipped.
    if (store.isIndexed(sessionId, PROMPT_VERSION, client ? client.label : '')) { skipped++; continue; }

    totalCands += cands.length;
    if (dry) {
      console.log(`  ${C.dim}${path.basename(f.file).slice(0, 8)}${C.off}  ${cands.length} candidates`);
      continue;
    }

    const commits = authoredCommits(msgs);
    const byUuid = new Map(kept.map((m) => [m.uuid, m]));
    let cards = [], rejected = [];

    for (let i = 0; i < cands.length; i += batch) {
      const out = await judgeBatch(cands.slice(i, i + batch), client, { toPrompt });
      cards.push(...out.cards);
      rejected.push(...out.rejected, ...out.errors);
    }

    // Attach both locators before anything is stored.
    for (const card of cards) {
      card.commit = joinCommit(commits, Date.parse(card.timestamp));
      const src = byUuid.get(card.quoteMessageUuid) || byUuid.get(card.messageUuid);
      if (src) card.receipt = locate(src, { match: card.quote });
    }

    const added = store.addCards(cards);
    store.recordRun({
      sessionId, promptVersion: PROMPT_VERSION, model: client.label, file: f.file,
      candidates: cands.length, cards: cards.length, rejected: rejected.length,
      costUsd: 0,
    });
    totalCards += added;
    totalRej += rejected.length;
    console.log(`  ${C.dim}${sessionId.slice(0, 8)}${C.off}  ${cands.length} cand -> ` +
      `${C.green}${added} cards${C.off}, ${rejected.length} rejected`);
  }

  const u = (client && client.usage) || {};
  console.log(`\n${C.b}done${C.off}  ${totalCands} candidates, ${totalCards} cards, ` +
    `${totalRej} rejected${skipped ? `, ${skipped} sessions already indexed` : ''}`);
  if (u.costUsd) console.log(`cost  $${u.costUsd.toFixed(4)}`);
  store.close();
  process.exit(0);
}

// --------------------------------------------------------------- stats
if (cmd === 'stats') {
  const s = store.stats();
  console.log(`${C.b}recall${C.off}  ${s.file}`);
  console.log(`  cards            ${s.cards}`);
  console.log(`  sessions         ${s.sessions}`);
  console.log(`  with a commit    ${s.withCommit}${s.cards ? ` (${((s.withCommit / s.cards) * 100).toFixed(0)}%)` : ''}`);
  console.log(`  indexed sessions ${s.indexedSessions}`);
  for (const t of s.byType) console.log(`    ${t.type.padEnd(16)} ${t.n}`);
  store.close();
  process.exit(0);
}

// --------------------------------------------------------------- doctor
if (cmd === 'doctor') {
  const a = store.audit();
  console.log(`${C.b}receipt integrity${C.off}  ${a.ok}/${a.total} verify`);
  if (!a.broken.length) {
    console.log(`${C.green}  every receipt proves its own excerpt${C.off}`);
  } else {
    for (const b of a.broken) {
      console.log(`  ${C.amber}${b.id}${C.off} ${b.quoteSource}` +
        `${b.knownBug ? `  ${C.dim}(known bug: hash of empty string — repairable)${C.off}`
                      : `  ${C.b}UNEXPLAINED — do not repair blindly${C.off}`}`);
    }
    if (has('--repair')) {
      const r = store.repair();
      console.log(`\n${C.green}repaired ${r.fixed}${C.off}` +
        (r.refused.length ? `, ${C.amber}refused ${r.refused.length}${C.off} (not the known bug)` : ''));
      const after = store.audit();
      console.log(`now ${after.ok}/${after.total} verify`);
    } else {
      console.log(`\n${C.dim}run \`recall doctor --repair\` to fix only the known bug${C.off}`);
    }
  }
  store.close();
  process.exit(0);
}

// --------------------------------------------------------------- backup
if (cmd === 'backup') {
  const to = argv[argv.indexOf('backup') + 1]
    || path.join(process.env.RECALL_HOME || path.join(os.homedir(), '.recall'), 'recall.backup.db');
  console.log('wrote', store.backup(to));
  store.close();
  process.exit(0);
}

// --------------------------------------------------------------- why
if (cmd === 'why') {
  const id = argv[argv.indexOf('why') + 1];
  const c = id && store.get(id);
  if (!c) { console.error(`no card ${id}`); process.exit(1); }
  console.log(`${C.b}${c.title}${C.off}`);
  console.log(`${C.dim}${c.type} · ${c.certainty} · ${c.timestamp}${C.off}\n`);
  console.log(c.body + '\n');
  console.log(`${C.b}RECEIPT${C.off}`);
  console.log(`  quoted   ${C.amber}"${c.quote}"${C.off}`);
  console.log(`  from     ${c.quote_source === 'tool-output' ? 'tool output' : 'assistant message'}`);
  console.log(`  session  ${c.session_id}`);
  console.log(`  message  ${c.quote_msg_uuid}`);
  console.log(`  hash     ${c.excerpt_hash}`);
  console.log(`  commit   ${c.commit_sha ? `${c.commit_sha} (${c.commit_conf})` : `${C.dim}transcript-only${C.off}`}`);
  console.log(`  where    ${c.cwd || '—'}`);
  console.log(`\n${C.b}EXCERPT${C.off}\n${C.dim}${c.excerpt}${C.off}`);
  store.close();
  process.exit(0);
}

// --------------------------------------------------------------- ask
const grep = has('--grep');
const question = (grep ? flag('--grep') : cmd);
if (typeof question !== 'string' || !question.trim()) {
  console.error('ask a question, e.g. recall "why did the build hang?"');
  process.exit(1);
}

const res = await answer(store, question, grep ? null : await resolveClient());

if (!res.cards.length) {
  console.log(`${C.dim}nothing indexed matches that. try \`recall index\` first.${C.off}`);
  store.close();
  process.exit(0);
}

if (!grep) {
  console.log(`\n${res.text || `${C.dim}(no sentence survived citation checking)${C.off}`}\n`);
  if (res.dropped.length) {
    console.log(`${C.dim}dropped ${res.dropped.length} uncited sentence(s): ${res.dropped[0].why}${C.off}\n`);
  }
}

console.log(`${C.b}RECEIPTS${C.off}`);
for (const c of res.cards) {
  console.log(`\n  ${C.blue}[${c.id}]${C.off} ${c.title}`);
  console.log(`    ${C.amber}"${c.quote.slice(0, 160)}${c.quote.length > 160 ? '…' : ''}"${C.off}`);
  console.log(`    ${C.dim}${c.type} · ${String(c.timestamp).slice(0, 10)} · ${c.cwd || '—'}`);
  console.log(`    ${c.commit_sha ? `commit ${c.commit_sha}` : 'transcript-only'} · session ${c.session_id.slice(0, 8)}${C.off}`);
}

if (res.contradictions.length) {
  console.log(`\n${C.amber}${C.b}DISAGREEMENT${C.off}`);
  for (const x of res.contradictions) console.log(`  [${x.a}] vs [${x.b}] — ${x.why}`);
}

console.log(`\n${C.dim}recall why <id>  for the full receipt chain${C.off}`);
store.close();
