import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore, toMatchQuery, EMPTY_HASH, defaultStorePath } from '../src/store.js';
import { excerptHash, verifyExcerpt } from '../../recall-core/src/index.js';
import { enforceCitations, findContradictions, answer } from '../src/answer.js';
import { fakeClient } from '../src/clients.js';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'recall-')), 'r.db');

const card = (over = {}) => ({
  type: 'gotcha',
  title: 'git -c credential.helper appends instead of replacing',
  body: 'Passing -c credential.helper adds to the helper list, so GCM still runs first and hangs headless.',
  quote: 'appends to the helper list rather than replacing it',
  certainty: 'stated', quoteSource: 'message',
  sessionId: 's1', messageUuid: 'm1', quoteMessageUuid: 'm1',
  timestamp: '2026-07-28T10:00:00.000Z', cwd: 'E:/x',
  receipt: { excerpt: 'full excerpt text here', excerptHash: 'sha256:abc' },
  generator: 'error-retry', promptVersion: 'v1',
  ...over,
});

test('a card round-trips and is findable by BM25', () => {
  const s = openStore(tmp());
  assert.equal(s.addCards([card()]), 1);
  const hits = s.search('why does the credential helper hang?');
  assert.equal(hits.length, 1);
  assert.match(hits[0].title, /credential\.helper/);
  assert.equal(hits[0].excerpt, 'full excerpt text here');
  s.close();
});

// Resumed and compacted sessions replay history. Re-indexing must not double.
test('the same card twice is stored once', () => {
  const s = openStore(tmp());
  s.addCards([card()]);
  assert.equal(s.addCards([card()]), 0, 're-indexing must be idempotent');
  assert.equal(s.stats().cards, 1);
  s.close();
});

test('the ledger makes a re-run skip work already paid for', () => {
  const s = openStore(tmp());
  assert.equal(s.isIndexed('s1', 'v1', 'm'), false);
  s.recordRun({ sessionId: 's1', promptVersion: 'v1', model: 'm', candidates: 10, cards: 3, rejected: 7, costUsd: 0.02 });
  assert.equal(s.isIndexed('s1', 'v1', 'm'), true);
  // A new prompt version is different work and must re-run.
  assert.equal(s.isIndexed('s1', 'v2', 'm'), false);
  s.close();
});

// Measured: qwen3:4b marked 5 sessions "indexed" and produced 0 cards, which
// would have permanently blocked re-judging them with a capable model.
test('a pass that produced nothing never counts as done', () => {
  const s = openStore(tmp());
  s.recordRun({ sessionId: 's1', promptVersion: 'v1', model: 'qwen3:4b', candidates: 12, cards: 0, rejected: 12 });
  assert.equal(s.isIndexed('s1', 'v1', 'qwen3:4b'), false, 'zero cards is not done');

  // And a different model is different work even when the earlier one succeeded.
  s.recordRun({ sessionId: 's2', promptVersion: 'v1', model: 'qwen3:4b', candidates: 5, cards: 2, rejected: 3 });
  assert.equal(s.isIndexed('s2', 'v1', 'qwen3:4b'), true);
  assert.equal(s.isIndexed('s2', 'v1', 'claude-cli:haiku'), false);
  s.close();
});

// A store written by an older version must survive being opened by this one.
test('an older store gains the model column instead of crashing', () => {
  const file = tmp();
  const s1 = openStore(file);
  s1.db.exec(`DROP TABLE ledger`);
  s1.db.exec(`CREATE TABLE ledger (session_id TEXT NOT NULL, prompt_version TEXT NOT NULL,
    file TEXT, candidates INTEGER, cards INTEGER, rejected INTEGER, cost_usd REAL,
    finished_at TEXT, PRIMARY KEY (session_id, prompt_version))`);
  s1.db.prepare(`INSERT INTO ledger VALUES ('old','v1','f',3,1,2,0,'then')`).run();
  s1.db.prepare(`UPDATE meta SET value='1' WHERE key='schema_version'`).run();
  s1.close();

  const s2 = openStore(file);
  const cols = s2.db.prepare(`PRAGMA table_info(ledger)`).all().map((c) => c.name);
  assert.ok(cols.includes('model'), 'the migration must add the column');
  assert.equal(s2.db.prepare(`SELECT COUNT(*) n FROM ledger`).get().n, 1, 'old rows survive');
  s2.close();
});

// FTS5 treats -, *, : and NEAR as operators. A real question is a syntax error
// unless every term is quoted, and this is the exact question that found it.
test('a natural question does not blow up the query parser', () => {
  const s = openStore(tmp());
  s.addCards([card()]);
  for (const q of ['why did git -c credential.helper fail?', 'NEAR the * thing:', 'a b']) {
    assert.doesNotThrow(() => s.search(q), q);
  }
  assert.equal(toMatchQuery('why did the build FAIL?'), '"build" OR "fail"');
  s.close();
});

test('a transcript-only card is stored without a wrong SHA', () => {
  const s = openStore(tmp());
  s.addCards([card({ commit: null })]);
  const hit = s.search('credential helper')[0];
  assert.equal(hit.commit_sha, null);
  s.close();
});

test('backup uses VACUUM INTO and is readable', () => {
  const s = openStore(tmp());
  s.addCards([card()]);
  const to = path.join(path.dirname(s.file), 'backup.db');
  s.backup(to);
  const b = openStore(to);
  assert.equal(b.stats().cards, 1);
  b.close();
  s.close();
});

// ------------------------------------------------------------ answering
// Answer-level faithfulness: a sentence citing a card that was not retrieved is
// a fabrication, and must never reach the user.
test('sentences citing unknown cards are dropped', () => {
  const out = enforceCitations(
    'The helper appends [aaaaaaaa]. It was fixed in v2 [ffffffff]. Also this is unsourced.',
    ['aaaaaaaa'],
  );
  assert.match(out.text, /helper appends/);
  assert.ok(!out.text.includes('ffffffff'), 'unknown card id must not survive');
  assert.ok(!out.text.includes('unsourced'), 'an uncited sentence must not survive');
  assert.equal(out.dropped.length, 2);
});

test('contradictions surface instead of being silently resolved', () => {
  const hits = [
    { id: 'a', type: 'decision', title: 'use SQLite FTS5 for retrieval', timestamp: '2026-07-01' },
    { id: 'b', type: 'failed_approach', title: 'SQLite FTS5 retrieval approach', timestamp: '2026-07-20' },
  ];
  const x = findContradictions(hits);
  assert.equal(x.length, 1);
  assert.match(x[0].why, /decision vs failed_approach/);
});

test('grep mode returns cards and never calls a model', async () => {
  const s = openStore(tmp());
  s.addCards([card()]);
  const res = await answer(s, 'credential helper', null);
  assert.ok(res.grep);
  assert.equal(res.cards.length, 1);
  assert.equal(res.text, '');
  s.close();
});

test('an answer keeps only what it can cite', async () => {
  const s = openStore(tmp());
  s.addCards([card()]);
  const id = s.search('credential helper')[0].id;
  const client = fakeClient([`It appends rather than replaces [${id}]. I also recall it was a DNS issue.`]);
  const res = await answer(s, 'why did it hang?', client);
  assert.match(res.text, /appends rather than replaces/);
  assert.ok(!/DNS/.test(res.text), 'the uncited claim must be dropped');
  assert.equal(res.dropped.length, 1);
  s.close();
});

test('no hits is said plainly, not answered anyway', async () => {
  const s = openStore(tmp());
  const res = await answer(s, 'something never indexed', fakeClient(['should not be called']));
  assert.equal(res.cards.length, 0);
  assert.equal(res.text, '');
  s.close();
});

// Measured failure: "PIL matplotlib executable build" returned cards about
// TikTok API review times, because a pure OR query lets one common word win.
// Narrow first, relax only when nothing matches.
test('a specific query does not lose to a common word', () => {
  const s = openStore(tmp());
  s.addCards([
    card({ sessionId: 'a', quote: 'matplotlib needs PIL', title: 'Excluding PIL breaks matplotlib in a build',
           body: 'Excluding PIL from an executable build breaks matplotlib because its import chain reaches colors.' }),
    card({ sessionId: 'b', quote: 'apply for access now, in parallel with building',
           title: 'Apply for platform API access early', body: 'Review takes weeks, so apply while building rather than after.' }),
  ]);
  const hits = s.search('PIL matplotlib executable build');
  assert.match(hits[0].title, /PIL/, 'the card matching most terms must rank first');
  s.close();
});

test('an unmatchable query still returns something rather than nothing', () => {
  const s = openStore(tmp());
  s.addCards([card()]);
  // No card contains "kubernetes", but "credential" is there — OR fallback.
  const hits = s.search('kubernetes credential');
  assert.ok(hits.length >= 1, 'relaxing to OR is the point of the fallback');
  s.close();
});

// A receipt that cannot verify itself proves nothing. This shipped once: a card
// quoting tool output built its receipt from the (empty) message body, storing
// the hash of "" beside a real excerpt.
test('every stored receipt verifies its own excerpt', () => {
  const s = openStore(tmp());
  s.addCards([
    // The exact broken shape: empty excerpt, hash of empty string.
    card({ sessionId: 'a', quoteSource: 'tool-output',
           receipt: { excerpt: '', excerptHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' } }),
    card({ sessionId: 'b', receipt: { excerpt: 'a real excerpt', excerptHash: excerptHash('a real excerpt') } }),
    card({ sessionId: 'c', receipt: null }),
  ]);
  const rows = s.db.prepare('SELECT excerpt, excerpt_hash FROM cards').all();
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.ok(r.excerpt.length > 0, 'an excerpt is never empty');
    assert.ok(verifyExcerpt({ excerptHash: r.excerpt_hash }, r.excerpt),
      `hash must verify its excerpt: ${r.excerpt.slice(0, 40)}`);
  }
  s.close();
});

// A provenance tool must not silently rewrite a hash that fails to verify:
// that is either a bug we shipped or evidence of tampering, and rewriting
// destroys the only signal that tells them apart.
test('audit reports broken receipts and repair fixes only the known bug', () => {
  const s = openStore(tmp());
  s.addCards([card({ sessionId: 'good' })]);
  // Two broken rows: one with the empty-hash signature, one tampered.
  s.db.prepare(`INSERT INTO cards (id,type,title,body,quote,certainty,quote_source,
    session_id,message_uuid,quote_msg_uuid,timestamp,excerpt,excerpt_hash,indexed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('knownbug', 'gotcha', 't', 'b'.repeat(30), 'q'.repeat(20), 'stated', 'tool-output',
         's', 'm', 'm', '2026-07-28T10:00:00Z', 'real excerpt text', EMPTY_HASH, 'now');
  s.db.prepare(`INSERT INTO cards (id,type,title,body,quote,certainty,quote_source,
    session_id,message_uuid,quote_msg_uuid,timestamp,excerpt,excerpt_hash,indexed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('tampered', 'gotcha', 't', 'b'.repeat(30), 'q'.repeat(20), 'stated', 'message',
         's', 'm', 'm', '2026-07-28T10:00:00Z', 'text', 'sha256:deadbeef', 'now');

  const a = s.audit();
  assert.equal(a.total, 3);
  assert.equal(a.broken.length, 2);
  assert.equal(a.broken.find((b) => b.id === 'knownbug').knownBug, true);
  assert.equal(a.broken.find((b) => b.id === 'tampered').knownBug, false);

  const r = s.repair();
  assert.equal(r.fixed, 1, 'only the known bug is repaired');
  assert.equal(r.refused.length, 1, 'unexplained mismatch is left as evidence');
  assert.equal(s.audit().broken.length, 1);
  s.close();
});

// Measured, not assumed: qwen3:4b produced 0 usable cards across two runs at
// ~110s/candidate. The tool must say so before a long run, not after one.
test('a too-small local model is refused before it wastes a night', async () => {
  const { judgeCapability } = await import('../src/providers.js');
  const small = judgeCapability('localhost:qwen3:4b');
  assert.equal(small.ok, false);
  assert.match(small.why, /0 usable cards|paraphrases/);
  assert.match(small.fix, /groq|qwen3\.6/i);

  assert.equal(judgeCapability('localhost:qwen3.6:latest').ok, true, '36B is allowed');
  assert.equal(judgeCapability('api.groq.com:llama-3.3-70b-versatile').ok, true, 'hosted is never blocked');
  assert.equal(judgeCapability('claude-cli:haiku').ok, true);
});

// Vaishak's home directory is on C: while every project lives on E:, and the
// store grows with every session indexed. Where it lands is a real decision.
test('RECALL_HOME moves the store off the home drive', () => {
  const prev = process.env.RECALL_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-home-'));
  try {
    process.env.RECALL_HOME = dir;
    assert.equal(defaultStorePath(), path.join(dir, 'recall.db'));
    const s = openStore();
    assert.ok(fs.existsSync(path.join(dir, 'recall.db')), 'store must be created there');
    s.close();
  } finally {
    if (prev === undefined) delete process.env.RECALL_HOME;
    else process.env.RECALL_HOME = prev;
  }
  assert.ok(!defaultStorePath().startsWith(dir), 'unset must fall back to home');
});
