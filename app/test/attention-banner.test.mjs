import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('attention-bar container exists in index.html and harness.html', () => {
  const indexHtml = readFileSync(resolve('index.html'), 'utf-8');
  const harnessHtml = readFileSync(resolve('harness.html'), 'utf-8');

  assert.ok(
    indexHtml.includes('id="attention-bar"'),
    'index.html must have #attention-bar element'
  );
  assert.ok(
    harnessHtml.includes('id="attention-bar"'),
    'harness.html must have #attention-bar element'
  );
});

test('pane template includes pane-action-banner with text and buttons', () => {
  const mainJs = readFileSync(resolve('src/main.js'), 'utf-8');

  assert.ok(
    mainJs.includes('pane-action-banner'),
    'main.js must declare pane-action-banner container'
  );
  assert.ok(
    mainJs.includes('action-banner-text'),
    'main.js must declare action-banner-text container'
  );
  assert.ok(
    mainJs.includes('action-banner-btns'),
    'main.js must declare action-banner-btns container'
  );
  assert.ok(
    mainJs.includes("invoke('pty_write', { id: p.id, data: 'y\\r' })"),
    'Approve action must send y\\r via pty_write'
  );
  assert.ok(
    mainJs.includes("invoke('pty_write', { id: p.id, data: 'n\\r' })"),
    'Reject action must send n\\r via pty_write'
  );
});

test('style.css defines attention-bar, triage chips, and action banners', () => {
  const styleCss = readFileSync(resolve('src/style.css'), 'utf-8');

  assert.ok(styleCss.includes('.attention-bar'), 'style.css must style .attention-bar');
  assert.ok(styleCss.includes('.attn-chip'), 'style.css must style .attn-chip');
  assert.ok(styleCss.includes('.attn-chip.urgent'), 'style.css must style .attn-chip.urgent');
  assert.ok(styleCss.includes('.attn-chip.action'), 'style.css must style .attn-chip.action');
  assert.ok(styleCss.includes('.pane-action-banner'), 'style.css must style .pane-action-banner');
  assert.ok(styleCss.includes('.action-banner-btn'), 'style.css must style .action-banner-btn');
  assert.ok(
    styleCss.includes('#muster .lamp[data-attention="urgent"]'),
    'style.css must style urgent muster lamps'
  );
});
