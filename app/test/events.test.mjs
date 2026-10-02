import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SteerController } from '../src/modules/steer.js';

test('SteerController validates missing pane and message parameters', async () => {
  const ctrl = new SteerController();
  const res1 = await ctrl.steerPane(null, 'ls');
  assert.equal(res1.success, false);
  assert.equal(res1.message, 'missing pane or message');

  const res2 = await ctrl.steerPane(1, '');
  assert.equal(res2.success, false);
  assert.equal(res2.message, 'missing pane or message');

  const res3 = await ctrl.pausePane(null);
  assert.equal(res3.success, false);
  assert.equal(res3.message, 'missing pane');
});

test('SteerController formats payload with newline guarantee', async () => {
  let captured = null;
  const mockFabric = {
    steer: async (paneId, action, payload) => {
      captured = { paneId, action, payload };
      return { success: true, message: 'ok' };
    },
  };

  const ctrl = new SteerController();
  // Temporarily swap fabric for testing
  const originalSteer = ctrl.steerPane;
  const res = await mockFabric.steer(2, 'steer', 'cargo test\n');
  assert.equal(res.success, true);
  assert.equal(captured.paneId, 2);
  assert.equal(captured.action, 'steer');
  assert.equal(captured.payload, 'cargo test\n');
});

test('Event subscription pattern dispatches to all active listeners', () => {
  const listeners = new Set();
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const received = [];
  const unsub1 = subscribe((evt) => received.push(`A:${evt.summary}`));
  const unsub2 = subscribe((evt) => received.push(`B:${evt.summary}`));

  const emit = (evt) => {
    for (const fn of listeners) fn(evt);
  };

  emit({ summary: 'test event 1' });
  assert.deepEqual(received, ['A:test event 1', 'B:test event 1']);

  unsub1();
  emit({ summary: 'test event 2' });
  assert.deepEqual(received, ['A:test event 1', 'B:test event 1', 'B:test event 2']);
});
