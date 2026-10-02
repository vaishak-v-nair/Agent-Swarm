// Regression: ISSUE-003 — Escape key trapped in terminal when overlay is open
// Found by /qa on 2026-10-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-02.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('main.js intercepts Escape key in terminal handler when overlays are open', () => {
  const mainPath = path.resolve('src/main.js');
  const source = fs.readFileSync(mainPath, 'utf8');

  // Verify Escape is handled inside attachCustomKeyEventHandler
  const handlerMatch = source.match(/attachCustomKeyEventHandler\([\s\S]*?Escape[\s\S]*?closeTimeline/);
  assert.ok(
    handlerMatch,
    'attachCustomKeyEventHandler must intercept Escape key to close open overlays'
  );
});
