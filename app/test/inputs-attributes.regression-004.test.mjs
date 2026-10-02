// Regression: ISSUE-004 — Form field elements missing id or name attributes
// Found by /qa on 2026-10-02
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-02.md

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('index.html pal-input has id and name attributes', () => {
  const indexPath = path.resolve('index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  assert.ok(
    /id="pal-input"[^>]*name="palette-query"|name="palette-query"[^>]*id="pal-input"/.test(indexHtml),
    '#pal-input must possess a name attribute for accessibility'
  );
});

test('main.js dynamic inputs have name attributes', () => {
  const mainPath = path.resolve('src/main.js');
  const mainJs = fs.readFileSync(mainPath, 'utf8');

  assert.ok(mainJs.includes('name="find-in-pane"'), 'Find input must have name="find-in-pane"');
  assert.ok(mainJs.includes("bar.name = 'search-query'"), 'Search input must have name="search-query"');
  assert.ok(mainJs.includes('name="${key}"'), 'Settings inputs must have name attribute');
});
