// Regression: ISSUE-005 — 404 error on missing favicon
// Found by /qa on 2026-10-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-02.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('index.html and harness.html define favicon link tags', () => {
  const indexPath = path.resolve('index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  const harnessPath = path.resolve('harness.html');
  const harnessHtml = fs.readFileSync(harnessPath, 'utf8');

  assert.ok(
    indexHtml.includes('<link rel="icon"'),
    'index.html must include a favicon link tag'
  );
  assert.ok(
    harnessHtml.includes('<link rel="icon"'),
    'harness.html must include a favicon link tag'
  );
});
