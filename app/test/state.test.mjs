import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paneState, fmt, QUIET_MS, STUCK_MS } from '../src/state.js';

const NOW = 1_000_000;

/** A pane that has been streaming output continuously and has nothing outstanding. */
const pane = (over = {}) => ({
  alive: true,
  born: NOW - 60_000,
  quietSince: 0,          // streaming
  lastCardAt: NOW - 100,
  lastKind: null,
  bellAt: 0,
  own: true,          // following this pane's own session
  pending: new Map(),
  ...over,
});
const tool = (name, agoMs) => new Map([['tu_1', { name, at: NOW - agoMs }]]);

test('streaming output reads as working', () => {
  assert.equal(paneState(pane(), NOW).key, 'work');
});

test('a running tool is working, not a problem', () => {
  // a build that spews output for six minutes must never be called "needs you"
  const s = paneState(pane({ pending: tool('Bash', 360_000), quietSince: 0 }), NOW);
  assert.equal(s.key, 'work');
  assert.equal(s.label, 'Bash');
  assert.equal(s.since, 360_000);   // elapsed is the call, not the last byte
});

test('a tool that went quiet is waiting on you', () => {
  const s = paneState(pane({ pending: tool('Bash', 30_000), quietSince: NOW - STUCK_MS - 1 }), NOW);
  assert.equal(s.key, 'needs');
  assert.equal(s.label, 'waiting · Bash');
  assert.equal(s.since, 30_000);    // how long YOU have been the blocker
});

test('silence shorter than the threshold is not an alarm', () => {
  // the gap between a tool starting and its first byte must not trip the alarm
  const s = paneState(pane({ pending: tool('Bash', 3000), quietSince: NOW - (STUCK_MS - 500) }), NOW);
  assert.equal(s.key, 'work');
});

test('the bell outranks everything', () => {
  const s = paneState(pane({ bellAt: NOW - 5000, quietSince: 0 }), NOW);
  assert.equal(s.key, 'needs');
  assert.equal(s.label, 'needs you');
  assert.equal(s.since, 5000);
});

test('the oldest outstanding tool is the one reported', () => {
  const pending = new Map([
    ['a', { name: 'Read', at: NOW - 5_000 }],
    ['b', { name: 'Bash', at: NOW - 90_000 }],
    ['c', { name: 'Grep', at: NOW - 20_000 }],
  ]);
  const s = paneState(pane({ pending, quietSince: NOW - STUCK_MS - 1 }), NOW);
  assert.equal(s.label, 'waiting · Bash');
  assert.equal(s.since, 90_000);
});

test('claude spoke last and nothing followed: your turn', () => {
  const s = paneState(pane({ lastKind: 'claude', quietSince: NOW - 30_000, lastCardAt: NOW - 30_000 }), NOW);
  assert.equal(s.key, 'done');
  assert.equal(s.label, 'your turn');
});

test('quiet with no context is idle, not an alarm', () => {
  // a plain shell sitting at a prompt has done nothing wrong
  assert.equal(paneState(pane({ quietSince: NOW - 300_000 }), NOW).key, 'idle');
});

test('a dead pane never asks for anything', () => {
  // the loudest possible false positive: a corpse demanding attention forever
  const s = paneState(pane({ alive: false, bellAt: NOW - 1000, pending: tool('Bash', 99_000) }), NOW);
  assert.equal(s.key, 'ended');
});

test('a pane that has never streamed is not instantly stale', () => {
  // quietSince 0 means "streaming", and must never be read as epoch zero and
  // reported as a 56-year silence
  const s = paneState(pane({ quietSince: 0, born: NOW - 500 }), NOW);
  assert.equal(s.key, 'work');
  assert.equal(s.since, 0);
});

test('a repaint does not count as progress', () => {
  // the flapping caught live: claude's own interface redraws while idle, so
  // "a byte arrived" flipped the pane between working and idle every 2 seconds.
  // quietSince only clears above the throughput floor, so a repaint leaves it be.
  const s = paneState(pane({ quietSince: NOW - 60_000 }), NOW);
  assert.equal(s.key, 'idle');
});

test('another session’s pending tool is never this pane’s alarm', () => {
  // the false positive caught in live testing: the watcher was catching up on a
  // different transcript, and its outstanding Bash call was paired with THIS
  // pane's silence to produce a confident "waiting · Bash"
  const p = pane({ own: false, pending: tool('Bash', 90_000), quietSince: NOW - STUCK_MS - 1 });
  const s = paneState(p, NOW);
  assert.notEqual(s.key, 'needs');
  assert.equal(s.key, 'idle');
});

test('a borrowed transcript cannot claim the turn is yours either', () => {
  const s = paneState(pane({ own: false, lastKind: 'claude', quietSince: NOW - 30_000, lastCardAt: NOW - 30_000 }), NOW);
  assert.equal(s.key, 'idle');
});

test('the bell still works before we lock onto our own session', () => {
  // the bell comes from THIS pane's terminal, so it is valid regardless
  const s = paneState(pane({ own: false, bellAt: NOW - 3000 }), NOW);
  assert.equal(s.key, 'needs');
});

test('elapsed time reads like a human wrote it', () => {
  assert.equal(fmt(0), '0s');
  assert.equal(fmt(45_000), '45s');
  assert.equal(fmt(60_000), '1m00s');
  assert.equal(fmt(754_000), '12m34s');
  assert.equal(fmt(3_600_000), '1h00m');
  assert.equal(fmt(4_920_000), '1h22m');
});

test('a threshold from the settings file is what actually gets used', () => {
  // M7: the point of a settings file is that the number in it wins. If tuning
  // silently did nothing, the file would be worse than no file at all.
  const p = pane({ pending: tool('Bash', 30_000), quietSince: NOW - 10_000 });

  // 10s of silence trips the 8s default…
  assert.equal(paneState(p, NOW).key, 'needs');
  // …and does not trip a 30s threshold the user chose
  assert.equal(paneState(p, NOW, { stuck_ms: 30_000 }).key, 'work');
  // an empty tune object falls back to the defaults rather than to zero
  assert.equal(paneState(p, NOW, {}).key, 'needs');
});
