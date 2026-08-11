import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordJudgments, flywheelPath } from '../src/flywheel.js';

const tmpFile = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fly-')), 'flywheel.jsonl');

const CANDS = [
  {
    sessionId: 's1', messageUuid: 'm1', generator: 'error-retry',
    text: 'fixed by exporting sk-abcdefghijklmnopqrstuvwxyz123456 before the run',
    trigger: null,
  },
  {
    sessionId: 's1', messageUuid: 'm2', generator: 'vocabulary',
    text: 'we chose FTS5 because portability beat velocity here',
    trigger: 'ModuleNotFoundError: No module named PIL',
  },
];

test('every judgment becomes one row, and which half it was survives', () => {
  const file = tmpFile();
  const n = recordJudgments({
    candidates: CANDS,
    cards: [{ messageUuid: 'm2', quote: 'portability beat velocity', type: 'decision' }],
    rejected: [{ id: 'm1', reason: 'quote not found in source — fabricated or paraphrased', attemptedQuote: 'exporting the key fixed it' }],
    model: 'ollama:test', promptVersion: 'v1', file,
  });
  assert.equal(n, 2);
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);

  const yes = rows.find((r) => r.accepted);
  assert.equal(yes.quote, 'portability beat velocity');
  assert.equal(yes.cardType, 'decision');
  assert.equal(yes.humanVerdict, null, 'no machine fills the human field');

  const no = rows.find((r) => !r.accepted);
  assert.match(no.reason, /quote not found/);
  assert.equal(no.quote, 'exporting the key fixed it',
    'the attempted quote must survive — it separates a fabricating model from an over-strict gate');
});

// The file must be safe to hand to a training run on someone else's GPU.
test('secrets never reach the flywheel file', () => {
  const file = tmpFile();
  recordJudgments({
    candidates: CANDS,
    cards: [],
    rejected: [{ id: 'm1', reason: 'r' }, { id: 'm2', reason: 'r' }],
    file,
  });
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes('sk-abcdefghijklmnopqrstuvwxyz123456'), 'key must be redacted');
  assert.ok(raw.includes('[REDACTED'), 'redaction marker should be present');
});

test('appending is append-only and a batch error writes nothing for its candidates', () => {
  const file = tmpFile();
  recordJudgments({ candidates: CANDS, cards: [], rejected: [{ id: 'm1', reason: 'r' }], file });
  recordJudgments({ candidates: CANDS, cards: [], rejected: [{ id: 'm1', reason: 'r' }], file });
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n');
  // m2 has no verdict either time (simulating a batch error) -> 1 row per call.
  assert.equal(rows.length, 2, 'append, never truncate; unjudged candidates are not rows');
});

test('RECALL_HOME decides the default path', () => {
  const prev = process.env.RECALL_HOME;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fly-home-'));
  try {
    process.env.RECALL_HOME = dir;
    assert.equal(flywheelPath(), path.join(dir, 'flywheel.jsonl'));
  } finally {
    if (prev === undefined) delete process.env.RECALL_HOME;
    else process.env.RECALL_HOME = prev;
  }
});
