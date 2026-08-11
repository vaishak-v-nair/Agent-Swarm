// The paraphrase eval — P9 Lever 4, the card-shaped fight.
//
// Dense retrieval already lost on the public dataset (0.748 vs BM25's 0.892),
// but that corpus is extractive QA, where questions share vocabulary with
// their passage BY CONSTRUCTION. The real product risk is different: a
// developer asks "why does my child process hang" and the card says "execFile
// async form ignores the input option". No shared nouns. If FTS5 collapses
// there, embeddings earn a rematch; if it holds, the question closes.
//
// Run:  RECALL_HOME=E:/agent-swarm/recall/.store node eval/paraphrase.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../src/store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { queries } = JSON.parse(
  fs.readFileSync(path.join(here, 'paraphrase-queries.json'), 'utf8'));

const store = openStore();
const total = store.stats().cards;

let at1 = 0, at3 = 0, at5 = 0, mrrSum = 0;
const misses = [];
for (const { gold, query } of queries) {
  const hits = store.search(query, { limit: 10 });
  const rank = hits.findIndex((h) => h.id.startsWith(gold)) + 1; // 0 = miss
  if (rank === 1) at1++;
  if (rank >= 1 && rank <= 3) at3++;
  if (rank >= 1 && rank <= 5) at5++;
  if (rank) mrrSum += 1 / rank;
  else misses.push({ gold, query, got: hits.slice(0, 2).map((h) => h.title) });
}

const n = queries.length;
const out = {
  corpus_cards: total,
  queries: n,
  retriever: 'store.search (FTS5, narrow-then-relax)',
  recall_at_1: +(at1 / n).toFixed(3),
  recall_at_3: +(at3 / n).toFixed(3),
  recall_at_5: +(at5 / n).toFixed(3),
  mrr: +(mrrSum / n).toFixed(3),
  misses,
};
console.log(JSON.stringify(out, null, 2));
store.close();
