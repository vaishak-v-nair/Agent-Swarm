import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceController } from '../src/modules/workspace.js';
import { AdapterManager } from '../src/modules/adapters.js';

test('index.html and harness.html contain V2 app-shell and 4 zones', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const harnessHtml = fs.readFileSync(path.resolve('harness.html'), 'utf8');

  for (const [name, html] of [['index.html', indexHtml], ['harness.html', harnessHtml]]) {
    assert.ok(html.includes('id="app-shell"'), `${name} must include #app-shell`);
    assert.ok(html.includes('id="sidebar"'), `${name} must include #sidebar`);
    assert.ok(html.includes('id="main-workspace"'), `${name} must include #main-workspace`);
    assert.ok(html.includes('id="context-inspector"'), `${name} must include #context-inspector`);
    assert.ok(html.includes('id="terminal-drawer"'), `${name} must include #terminal-drawer`);
  }
});

test('WorkspaceController manages active navigation and session lifecycle', () => {
  const ws = new WorkspaceController();
  assert.equal(ws.activeNav, 'home');
  assert.equal(ws.activeSessionId, null);
  assert.equal(ws.drawerOpen, false);

  // Notifications
  let notified = 0;
  const unsub = ws.subscribe(() => notified++);

  // Nav change
  ws.selectNav('changes');
  assert.equal(ws.activeNav, 'changes');
  assert.equal(notified, 1);

  // Add session
  const sess = {
    id: 's-123',
    project_id: 'p-1',
    agent_type: 'claude',
    task_title: 'Refactor auth',
    pane_id: 2,
    status: 'working',
    attention_score: 0,
  };
  ws.addSession(sess);
  assert.equal(ws.sessions.length, 1);
  assert.equal(ws.activeSessionId, 's-123');
  assert.equal(ws.activeNav, 'session');
  assert.equal(notified, 2);

  // Drawer toggle
  ws.toggleDrawer(true);
  assert.equal(ws.drawerOpen, true);
  ws.toggleDrawer(false);
  assert.equal(ws.drawerOpen, false);
  ws.toggleDrawer();
  assert.equal(ws.drawerOpen, true);

  unsub();
});

test('AdapterManager provides vendor-neutral metadata and resilient fallbacks', () => {
  const mgr = new AdapterManager();
  
  const claudeMeta = mgr.getMeta('claude');
  assert.equal(claudeMeta.name, 'Claude Code');
  assert.equal(claudeMeta.icon, '✦');

  const codexMeta = mgr.getMeta('codex');
  assert.equal(codexMeta.name, 'OpenAI Codex');
  assert.equal(codexMeta.icon, '⚙');

  const geminiMeta = mgr.getMeta('gemini');
  assert.equal(geminiMeta.name, 'Gemini CLI');
  assert.equal(geminiMeta.icon, '⚡');

  const copilotMeta = mgr.getMeta('copilot');
  assert.equal(copilotMeta.name, 'GitHub Copilot');

  const fallbackMeta = mgr.getMeta('unknown-cli-agent');
  assert.equal(fallbackMeta.name, 'unknown-cli-agent');
  assert.equal(fallbackMeta.badgeClass, 'adapter-generic');
});
