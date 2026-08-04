#!/usr/bin/env node
// recall-mcp — AgentSwarm + Recall.
//
// This is the join the CEO review deferred as "the cross-product memory
// surface". It is an MCP server over stdio, so every Claude Code session —
// and therefore every pane in AgentSwarm — can ask what past sessions already
// learned, and get an answer with the exact transcript line and commit behind it.
//
// Why this is the right shape for the join:
//   * AgentSwarm runs many agents; each starts from a blank context. The
//     expensive thing is not thinking, it is RE-DERIVING what was already
//     settled three weeks ago in a pane that has since been closed.
//   * An agent that can query the store stops re-deriving. A human watching
//     the same pane sees the receipt and can check it.
//   * It is READ-ONLY on purpose. Memory that an agent can silently write to
//     is memory you cannot trust; extraction stays a deliberate, audited step.
//
// Install (per-project or globally):
//   claude mcp add -s user recall -e RECALL_HOME=E:/agent-swarm/recall/.store \
//     -- node E:/agent-swarm/recall/recall/bin/recall-mcp.js
//
// RECALL_HOME matters here: without it an agent reads the default store under
// the home directory while everything else reads the project one, and the
// mismatch is silent — the tools answer, just from the wrong memory.
//
// No network. No LLM. Retrieval is BM25 over the local store, so a pane can
// call this as often as it likes for free.

import process from 'node:process';
import { openStore, defaultStorePath } from '../src/store.js';
import { findContradictions } from '../src/answer.js';

const PROTOCOL_VERSION = '2024-11-05';
const store = openStore(process.env.RECALL_STORE || defaultStorePath());

const TOOLS = [
  {
    name: 'recall_search',
    description:
      'Search this developer\'s past AI coding sessions for knowledge already learned — gotchas, decisions, solutions and failed approaches — each with the exact transcript line and commit it came from. Use it BEFORE re-deriving something, debugging a known-hairy area, or choosing an approach: the answer may already exist with proof. Returns [] when nothing matches, which means the corpus genuinely has nothing.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What you want to know, in plain words.' },
        limit: { type: 'number', description: 'Max cards (default 6).' },
        type: {
          type: 'string',
          enum: ['gotcha', 'decision', 'solution', 'failed_approach'],
          description: 'Optional filter by card type.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'recall_why',
    description:
      'Show the full receipt chain for one card: the verbatim excerpt, whether it came from an assistant message or tool output, its session and message ids, the content hash proving the excerpt is unaltered, and the commit if one was authored. Use it to verify a card before acting on it.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Card id from recall_search.' } },
      required: ['id'],
    },
  },
  {
    name: 'recall_stats',
    description: 'What is in the memory store: card counts by type, sessions indexed, receipt integrity.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function searchTool({ query, limit = 6, type = null }) {
  let cards = store.search(String(query || ''), { limit: type ? limit * 3 : limit });
  if (type) cards = cards.filter((c) => c.type === type).slice(0, limit);

  if (!cards.length) {
    return `No cards match "${query}". The store has ${store.stats().cards} cards; this subject is genuinely absent, so proceed from first principles rather than assuming memory failed.`;
  }

  const lines = cards.map((c) => {
    const commit = c.commit_sha ? `commit ${c.commit_sha}` : 'transcript-only';
    return [
      `[${c.id}] ${c.type.toUpperCase()}${c.certainty === 'hedged' ? ' (hedged — the source was not certain)' : ''}`,
      `  ${c.title}`,
      `  ${c.body}`,
      `  quoted: "${c.quote}"`,
      `  ${String(c.timestamp).slice(0, 10)} · ${c.cwd || 'unknown cwd'} · ${commit}`,
    ].join('\n');
  });

  const clash = findContradictions(cards);
  if (clash.length) {
    lines.push(
      `\nCONTRADICTION — these disagree and are NOT resolved for you:\n` +
        clash.map((x) => `  [${x.a}] vs [${x.b}] — ${x.why}`).join('\n'),
    );
  }
  lines.push(`\nCall recall_why with an id for the full receipt before relying on a card.`);
  return lines.join('\n\n');
}

function whyTool({ id }) {
  const c = store.get(String(id || ''));
  if (!c) return `No card ${id}.`;
  return [
    c.title,
    `${c.type} · ${c.certainty} · ${c.timestamp}`,
    '',
    c.body,
    '',
    'RECEIPT',
    `  quoted:  "${c.quote}"`,
    `  from:    ${c.quote_source === 'tool-output' ? 'tool output' : 'assistant message'}`,
    `  session: ${c.session_id}`,
    `  message: ${c.quote_msg_uuid}`,
    `  hash:    ${c.excerpt_hash}`,
    `  commit:  ${c.commit_sha ? `${c.commit_sha} (${c.commit_conf})` : 'none — ships transcript-only rather than a wrong SHA'}`,
    `  where:   ${c.cwd || '—'}`,
    '',
    'EXCERPT',
    c.excerpt,
  ].join('\n');
}

function statsTool() {
  const s = store.stats();
  const a = store.audit();
  return [
    `${s.cards} cards from ${s.sessions} sessions (${s.indexedSessions} indexed)`,
    ...s.byType.map((t) => `  ${t.type}: ${t.n}`),
    `${s.withCommit} carry a commit; the rest are transcript-only`,
    `receipt integrity: ${a.ok}/${a.total} verify`,
    `store: ${s.file}`,
  ].join('\n');
}

const HANDLERS = { recall_search: searchTool, recall_why: whyTool, recall_stats: statsTool };

// ---------------------------------------------------------------- transport
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}
function ok(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handle(req) {
  const { id, method, params } = req;
  // Notifications carry no id and must never be answered.
  if (id === undefined || id === null) return;

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'recall', version: '0.1.0' },
    });
  }
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const fn = HANDLERS[params?.name];
    if (!fn) return fail(id, -32601, `unknown tool: ${params?.name}`);
    try {
      return ok(id, { content: [{ type: 'text', text: fn(params.arguments || {}) }] });
    } catch (e) {
      // A tool error is reported as content, not as a protocol failure, so the
      // agent can read what went wrong and carry on.
      return ok(id, { content: [{ type: 'text', text: `recall error: ${e.message}` }], isError: true });
    }
  }
  if (method === 'ping') return ok(id, {});
  return fail(id, -32601, `unknown method: ${method}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      handle(JSON.parse(line));
    } catch {
      // A malformed line must not kill the server; the client may recover.
    }
  }
});
process.stdin.on('end', () => {
  store.close();
  process.exit(0);
});
