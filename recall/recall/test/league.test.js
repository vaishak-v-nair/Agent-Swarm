import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { judgeCapability } from '../src/providers.js';

// The league table is authoritative in BOTH directions: a measured pass lets a
// small local model through, and a measured fail refuses it with its own
// numbers instead of a size guess.

const withLeague = (models, fn) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'league-')), 'league.json');
  fs.writeFileSync(file, JSON.stringify({ n: 20, models }));
  const prev = process.env.RECALL_LEAGUE;
  process.env.RECALL_LEAGUE = file;
  try { fn(); } finally {
    if (prev === undefined) delete process.env.RECALL_LEAGUE;
    else process.env.RECALL_LEAGUE = prev;
  }
};

test('a measured fail refuses even a big model, quoting its numbers', () => {
  withLeague({
    'bigmodel:70b': { verdict: 'fail', grounding_rate: 0.4, abstain_precision: 0.2, n: 20, raw: { hallucinated: 9 } },
  }, () => {
    const cap = judgeCapability('localhost:bigmodel:70b @ http://localhost:11434/v1');
    assert.equal(cap.ok, false);
    assert.match(cap.why, /FAILED the measured league/);
    assert.match(cap.why, /9\/20 hallucinated/);
  });
});

test('a measured pass admits a small local model the heuristic would refuse', () => {
  withLeague({
    'tiny:3b': { verdict: 'pass', grounding_rate: 0.95, abstain_precision: 0.8, n: 20, raw: { hallucinated: 0 } },
  }, () => {
    const cap = judgeCapability('localhost:tiny:3b');
    assert.equal(cap.ok, true);
    assert.ok(cap.measured, 'the verdict should carry its measurement');
  });
});

test('an unmeasured small local model still hits the fallback, told to measure', () => {
  withLeague({}, () => {
    const cap = judgeCapability('localhost:stranger:4b');
    assert.equal(cap.ok, false);
    assert.match(cap.fix, /league\.py/);
  });
});

test('an errored measurement decides nothing', () => {
  withLeague({ 'broken:4b': { error: 'timeout' } }, () => {
    const cap = judgeCapability('localhost:broken:4b');
    assert.equal(cap.ok, false, 'falls through to the size heuristic');
    assert.match(cap.why, /no league measurement/);
  });
});
