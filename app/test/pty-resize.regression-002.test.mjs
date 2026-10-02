// Regression: ISSUE-002 — unhandled promise rejection in pty_resize
// Found by /qa on 2026-10-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-02.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('main.js handles pty_resize promise rejection with .catch handler', () => {
  const mainPath = path.resolve('src/main.js');
  const source = fs.readFileSync(mainPath, 'utf8');

  // Verify pty_resize call includes a catch handler
  const ptyResizeMatches = source.match(/invoke\('pty_resize'[\s\S]*?\)\.catch\(/);
  assert.ok(
    ptyResizeMatches,
    'invoke(\'pty_resize\') must have an attached .catch handler to prevent unhandled rejection'
  );
});
