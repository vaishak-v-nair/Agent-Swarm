import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesFrom, vocabularyHints, looksLikeError, toPrompt } from '../src/candidates.js';

const msg = (o) => ({
  uuid: o.uuid, sessionId: 's1', role: o.role || 'assistant',
  timestamp: o.ts || '2026-07-28T10:00:00.000Z', cwd: 'E:/x', file: 'f.jsonl',
  text: o.text || '', toolUses: o.toolUses || [], toolResults: o.toolResults || [],
  isCompactBoundary: false,
});

const LONG = 'The helper list appends rather than replacing, so GCM still runs first and hangs.';

test('a failure followed by prose becomes a candidate', () => {
  const out = candidatesFrom([
    msg({ uuid: 'a', role: 'user', toolResults: [{ toolUseId: 't', text: 'fatal: unable to access' }] }),
    msg({ uuid: 'b', text: LONG }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].generator, 'error-retry');
  assert.match(out[0].trigger, /fatal/);
});

// The probe's finding (c): the best cards carry NO trigger vocabulary. If the
// error->retry generator required keywords, it would miss them entirely.
test('a keyword-free gotcha after a failure is still surfaced', () => {
  const keywordFree = 'Root cause: venv on Python 3.15.0a8 — no prebuilt wheels exist yet.';
  assert.deepEqual(vocabularyHints('no prebuilt wheels exist yet'), [], 'fixture must be keyword-free');
  const out = candidatesFrom([
    msg({ uuid: 'a', role: 'user', toolResults: [{ toolUseId: 't', text: 'ERROR: Failed building wheel' }] }),
    msg({ uuid: 'b', text: keywordFree }),
  ]);
  assert.equal(out.length, 1, 'the highest-value card type must survive keyword-blindness');
});

// The probe's finding (b): regex INVERTS on negation. This test does not assert
// that negation is handled — it asserts we surface it anyway and leave the
// verdict to the judge, which is the whole point of a candidate generator.
test('negated text is surfaced, not judged', () => {
  const negated = 'We were right not to abandon PRAXIS; nothing was scrapped in the end.';
  assert.ok(vocabularyHints(negated).includes('abandonment'), 'regex does invert — documented');
  const out = candidatesFrom([msg({ uuid: 'a', text: negated })]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].hints, ['abandonment']);
  assert.equal(out[0].generator, 'vocabulary');
  // No `type`, no `verdict`, no `card` field anywhere: nothing here decided.
  assert.equal(out[0].type, undefined);
});

test('one message yields one candidate, error-retry winning', () => {
  const out = candidatesFrom([
    msg({ uuid: 'a', role: 'user', toolResults: [{ toolUseId: 't', text: 'Error: nope' }] }),
    msg({ uuid: 'b', text: 'Turns out the problem was a stale lockfile blocking the install.' }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].generator, 'error-retry', 'must not also fire as vocabulary');
});

test('chatter below the prose floor is ignored', () => {
  const out = candidatesFrom([
    msg({ uuid: 'a', role: 'user', toolResults: [{ toolUseId: 't', text: 'Error: nope' }] }),
    msg({ uuid: 'b', text: 'Fixed.' }),
  ]);
  assert.equal(out.length, 0);
});

test('full messages reach the judge — never a truncated slice', () => {
  const long = 'x'.repeat(4000) + ' root cause: the daemon never cached pre-existing files';
  const out = candidatesFrom([msg({ uuid: 'a', text: long })]);
  assert.equal(out[0].text.length, long.length, 'truncation destroyed real cards in the probe');
});

test('error detection is broad by design', () => {
  for (const s of ['Traceback (most recent call last)', 'ENOENT: no such file', 'exit code 1',
                   'MODULE_NOT_FOUND', 'Permission denied', 'AssertionError: x !== y']) {
    assert.ok(looksLikeError(s), s);
  }
  assert.ok(!looksLikeError('28 passed, 0 failing in 174ms'));
});

test('secrets are stripped and transcript text is fenced as data', () => {
  const out = candidatesFrom([
    msg({ uuid: 'a', text: 'Root cause: the token ghp_abcdefghijklmnopqrst1234 was stale, so auth failed.' }),
  ]);
  const p = toPrompt(out[0]);
  assert.ok(!p.text.includes('ghp_abcdefghijklmnopqrst1234'), 'no secret may reach an LLM call');
  assert.match(p.text, /REDACTED_GITHUB_TOKEN/);
  assert.match(p.text, /<<<TRANSCRIPT_DATA>>>[\s\S]*<<<TRANSCRIPT_DATA>>>/);
  assert.equal(p.meta.messageUuid, 'a', 'the locator survives to the judge');
});
