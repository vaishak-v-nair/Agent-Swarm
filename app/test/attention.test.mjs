import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AttentionController } from '../src/modules/attention.js';

test('AttentionController tracks levels and detects state escalations', () => {
  let chimesPlayed = [];
  const ctrl = new AttentionController({
    soundEnabled: true,
  });

  // Mock playChime to verify audio triggers
  ctrl.playChime = (level) => chimesPlayed.push(level);

  // Initial queue with pane 1 working
  ctrl.processQueue([
    { pane_id: 1, score: 5, level: 'working', reason: 'running cargo test' },
    { pane_id: 2, score: 0, level: 'idle', reason: 'waiting' },
  ]);

  assert.equal(chimesPlayed.length, 0, 'No chime on normal working state');

  // Pane 1 escalates to urgent (e.g. bell or error)
  ctrl.processQueue([
    { pane_id: 1, score: 50, level: 'urgent', reason: 'terminal bell rung' },
    { pane_id: 2, score: 0, level: 'idle', reason: 'waiting' },
  ]);

  assert.equal(chimesPlayed.length, 1);
  assert.equal(chimesPlayed[0], 'urgent', 'Escalation to urgent must trigger chime');

  // Pane 1 stays urgent - should not repeat chime immediately on same state
  ctrl.processQueue([
    { pane_id: 1, score: 50, level: 'urgent', reason: 'terminal bell rung' },
  ]);

  assert.equal(chimesPlayed.length, 1, 'Chime should not fire repeatedly on same state');

  // Pane 2 transitions to action_needed
  ctrl.processQueue([
    { pane_id: 1, score: 50, level: 'urgent', reason: 'terminal bell rung' },
    { pane_id: 2, score: 40, level: 'action_needed', reason: 'permission prompt' },
  ]);

  assert.equal(chimesPlayed.length, 2);
  assert.equal(chimesPlayed[1], 'action_needed');
});

test('AttentionController updates title badge count accurately', () => {
  const titles = [];
  globalThis.document = {
    set title(val) { titles.push(val); },
    get title() { return titles[titles.length - 1] || 'AgentSwarm'; },
  };

  const ctrl = new AttentionController();

  // 2 items needing attention
  ctrl.processQueue([
    { pane_id: 1, score: 50, level: 'urgent', reason: 'bell' },
    { pane_id: 2, score: 40, level: 'action_needed', reason: 'confirm' },
  ]);

  assert.equal(titles[titles.length - 1], '(2) AgentSwarm');

  // Resolved to 0
  ctrl.processQueue([
    { pane_id: 1, score: 0, level: 'idle', reason: 'idle' },
    { pane_id: 2, score: 5, level: 'working', reason: 'working' },
  ]);

  assert.equal(titles[titles.length - 1], 'AgentSwarm');
  delete globalThis.document;
});

test('AttentionController dispatches onQueueUpdated hook', () => {
  let receivedQueue = null;
  const ctrl = new AttentionController({
    onQueueUpdated: (q) => { receivedQueue = q; },
  });

  const testQueue = [
    { pane_id: 1, score: 45, level: 'urgent', reason: 'crash' },
  ];

  ctrl.processQueue(testQueue);
  assert.deepEqual(receivedQueue, testQueue);
});
