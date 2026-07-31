import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertOrdered, score, FEED_MAX } from '../src/order.js';

const at = (n, tag) => ({ at: n, tag });
const tags = f => f.map(c => c.tag).join('');

test('cards arriving in order are simply appended', () => {
  const f = [];
  insertOrdered(f, at(1, 'a'));
  insertOrdered(f, at(2, 'b'));
  insertOrdered(f, at(3, 'c'));
  assert.equal(tags(f), 'abc');
});

test('a late card lands in its real place, not at the end', () => {
  // the case that makes this worth testing: one pane replays history while
  // another streams live, so arrival order is not event order
  const f = [];
  insertOrdered(f, at(10, 'a'));
  insertOrdered(f, at(30, 'c'));
  insertOrdered(f, at(20, 'b'));
  assert.equal(tags(f), 'abc');
});

test('equal timestamps keep insertion order', () => {
  // Claude Code stamps to the second, so ties are common. If a tie reordered,
  // a tool call could appear above the message that asked for it.
  const f = [];
  insertOrdered(f, at(5, 'a'));
  insertOrdered(f, at(5, 'b'));
  insertOrdered(f, at(5, 'c'));
  assert.equal(tags(f), 'abc');
});

test('a whole out-of-order batch still sorts', () => {
  const f = [];
  for (const n of [50, 10, 40, 20, 30]) insertOrdered(f, at(n, String(n / 10)));
  assert.equal(tags(f), '12345');
});

test('the feed stays bounded, dropping the oldest', () => {
  const f = [];
  for (let i = 0; i < FEED_MAX + 25; i++) insertOrdered(f, at(i, 'x'));
  assert.equal(f.length, FEED_MAX);
  assert.equal(f[0].at, 25);              // the oldest 25 fell off the front
  assert.equal(f[f.length - 1].at, FEED_MAX + 24);
});

test('typing a few letters finds the swarm', () => {
  // a real match scores negatively, so the no-match sentinel must be
  // unreachable. Using -1 for both shipped a palette that dropped "mrn".
  assert.ok(Number.isFinite(score('swarm  morning', 'mrn')));
  assert.ok(Number.isFinite(score('swarm  morning', 'morn')));
  assert.equal(score('swarm  morning', 'zzz'), -Infinity);
});

test('a loose match still counts as a match', () => {
  const s = score('swarm  morning', 'mrn');
  assert.ok(s < -1, `expected a real match to score below -1, got ${s}`);
  assert.ok(Number.isFinite(s));
});

test('matching is case insensitive both ways', () => {
  assert.ok(Number.isFinite(score('Swarm  Morning', 'morning')));
  assert.ok(Number.isFinite(score('swarm  morning', 'MORNING')));
});

test('a tighter, earlier match ranks higher', () => {
  // "tim" should offer the timeline before "save this swarm as a recipe"
  const a = score('timeline  all sessions in order', 'tim');
  const b = score('save this swarm as a recipe', 'tim');
  assert.ok(a > b, `expected timeline (${a}) to beat save (${b})`);
});

test('an empty query keeps the authored order', () => {
  // every item scores the same, so recipes stay above panes stay above views
  assert.equal(score('anything at all', ''), 0);
  assert.equal(score('something else', ''), 0);
});
