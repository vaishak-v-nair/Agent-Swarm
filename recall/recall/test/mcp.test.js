// The AgentSwarm <-> Recall bridge, driven the way a real MCP client drives it:
// newline-delimited JSON-RPC over stdio.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../src/store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, '..', 'bin', 'recall-mcp.js');

function seededStore() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'recall-mcp-')), 'r.db');
  const s = openStore(file);
  s.addCards([
    {
      type: 'gotcha',
      title: 'Excluding PIL from a build breaks matplotlib',
      body: 'matplotlib imports matplotlib.colors, which needs PIL, so excluding PIL from an executable build breaks it at runtime.',
      quote: 'matplotlib needs PIL',
      certainty: 'stated', quoteSource: 'tool-output',
      sessionId: 'sess-1', messageUuid: 'msg-1', quoteMessageUuid: 'trig-1',
      timestamp: '2026-07-28T10:00:00.000Z', cwd: 'E:/agent-swarm',
      receipt: { excerpt: 'ModuleNotFoundError: No module named PIL — matplotlib needs PIL', excerptHash: '' },
      generator: 'error-retry', promptVersion: 'v1',
      commit: { sha: 'abc1234', confidence: 'high' },
    },
    {
      type: 'decision',
      title: 'Use SQLite FTS5 for retrieval',
      body: 'Chose SQLite FTS5 over embeddings for the first pass because it ships with Node and needs no model.',
      quote: 'FTS5 ships with Node and needs no model',
      certainty: 'stated', quoteSource: 'message',
      sessionId: 'sess-2', messageUuid: 'msg-2', quoteMessageUuid: 'msg-2',
      timestamp: '2026-07-30T10:00:00.000Z', cwd: 'E:/Recall',
      receipt: { excerpt: 'FTS5 ships with Node and needs no model', excerptHash: '' },
      generator: 'vocabulary', promptVersion: 'v1',
    },
  ]);
  s.close();
  return file;
}

/** Drive the server over stdio and collect the responses to `requests`. */
function rpc(storeFile, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      env: { ...process.env, RECALL_STORE: storeFile },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`timeout: ${err}`)); }, 25_000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', () => {
      clearTimeout(timer);
      const msgs = out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
      resolve({ msgs, err });
    });
    for (const r of requests) child.stdin.write(JSON.stringify(r) + '\n');
    child.stdin.end();
  });
}

const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };

test('it handshakes as an MCP server', async () => {
  const { msgs } = await rpc(seededStore(), [init]);
  const r = msgs.find((m) => m.id === 1).result;
  assert.equal(r.serverInfo.name, 'recall');
  assert.ok(r.capabilities.tools, 'must advertise tools');
});

test('it advertises the three read tools', async () => {
  const { msgs } = await rpc(seededStore(), [init, { jsonrpc: '2.0', id: 2, method: 'tools/list' }]);
  const names = msgs.find((m) => m.id === 2).result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['recall_search', 'recall_stats', 'recall_why']);
});

test('an agent can find prior knowledge and get its receipt', async () => {
  const file = seededStore();
  const { msgs } = await rpc(file, [
    init,
    { jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'recall_search', arguments: { query: 'matplotlib PIL build' } } },
  ]);
  const text = msgs.find((m) => m.id === 2).result.content[0].text;
  assert.match(text, /GOTCHA/);
  assert.match(text, /matplotlib needs PIL/);
  assert.match(text, /commit abc1234/, 'the commit locator must reach the agent');
  assert.match(text, /recall_why/, 'it must tell the agent how to verify');
});

// An empty result must not read as "the tool is broken" — it means the corpus
// genuinely has nothing, and the agent should proceed rather than retry.
test('no match says so plainly and tells the agent to proceed', async () => {
  const { msgs } = await rpc(seededStore(), [
    init,
    { jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'recall_search', arguments: { query: 'kubernetes helm chart rollback' } } },
  ]);
  const text = msgs.find((m) => m.id === 2).result.content[0].text;
  assert.match(text, /genuinely absent|No cards match/);
  assert.match(text, /first principles/);
});

test('recall_why returns the full receipt chain', async () => {
  const file = seededStore();
  const { msgs } = await rpc(file, [
    init,
    { jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'recall_search', arguments: { query: 'matplotlib PIL' } } },
  ]);
  const id = msgs.find((m) => m.id === 2).result.content[0].text.match(/\[([0-9a-f]{8,})\]/)[1];

  const second = await rpc(file, [
    init,
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'recall_why', arguments: { id } } },
  ]);
  const text = second.msgs.find((m) => m.id === 3).result.content[0].text;
  assert.match(text, /RECEIPT/);
  assert.match(text, /from:\s+tool output/, 'quote provenance must be explicit');
  assert.match(text, /hash:\s+sha256:/);
  assert.match(text, /session: sess-1/);
});

test('a filter narrows by card type', async () => {
  const { msgs } = await rpc(seededStore(), [
    init,
    { jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'recall_search', arguments: { query: 'FTS5 retrieval PIL matplotlib', type: 'decision' } } },
  ]);
  const text = msgs.find((m) => m.id === 2).result.content[0].text;
  assert.match(text, /DECISION/);
  assert.ok(!/GOTCHA/.test(text), 'the filter must exclude other types');
});

test('an unknown tool is a protocol error, a bad argument is not', async () => {
  const file = seededStore();
  const { msgs } = await rpc(file, [
    init,
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nope', arguments: {} } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'recall_why', arguments: { id: 'nonexistent' } } },
  ]);
  assert.ok(msgs.find((m) => m.id === 2).error, 'unknown tool -> JSON-RPC error');
  const bad = msgs.find((m) => m.id === 3).result.content[0].text;
  assert.match(bad, /No card/, 'a missing card is content the agent can read, not a crash');
});

// Notifications have no id and must never be answered, or the client desyncs.
test('notifications and junk lines do not produce replies or crash it', async () => {
  const { msgs } = await rpc(seededStore(), [
    init,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 9, method: 'ping' },
  ]);
  assert.equal(msgs.filter((m) => m.id === undefined).length, 0, 'no reply to a notification');
  assert.ok(msgs.find((m) => m.id === 9), 'the server survives and keeps answering');
});
