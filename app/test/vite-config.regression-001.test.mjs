// Regression: ISSUE-001 — vite watcher crashes on src-tauri binary locks
// Found by /qa on 2026-10-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-02.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../vite.config.js';

test('vite config ignores src-tauri files from file watcher', () => {
  assert.ok(config.server, 'config.server should be defined');
  assert.ok(config.server.watch, 'config.server.watch should be defined');
  assert.ok(Array.isArray(config.server.watch.ignored), 'server.watch.ignored should be an array');
  assert.ok(
    config.server.watch.ignored.some(pattern => pattern.includes('src-tauri')),
    'server.watch.ignored should include src-tauri to prevent EBUSY crashes'
  );
});
