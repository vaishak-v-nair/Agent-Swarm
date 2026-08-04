// Model backends for the judge.
//
// Two real ones, measured, plus a fake for tests. The judge does not know which
// it is talking to — it takes a `complete(system, user) -> Promise<string>`.
//
// COST, MEASURED 2026-08-02 (this matters and is not obvious):
//
//   claude CLI   one 10-token prompt cost $0.0221, because every invocation
//                ships ~24k tokens of Claude Code's own system prompt. Fine for
//                a handful of calls; at 1,782 candidates un-batched it is ~$39.
//   raw API      the same corpus is ~$2.65 (690k in / 392k out at Haiku rates).
//
// So: the API is the default when a key exists, the CLI is the zero-setup
// fallback, and BOTH batch hard because batching is what amortises the
// per-call overhead. Batching is not an optimisation here, it is the design.

import { spawn } from 'node:child_process';

/**
 * Run a command, writing `input` to its stdin.
 *
 * Not `execFile`: its async form silently ignores the `input` option (that is
 * `execFileSync` only), so the child waits on an stdin that never arrives and
 * exits with "Input must be provided". Cost a full sample run to find.
 */
function run(cmd, args, input, { timeoutMs, maxBuffer = 64 * 1024 * 1024 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: process.platform === 'win32' });
    let out = '';
    let err = '';
    let size = 0;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      size += d.length;
      if (size > maxBuffer) { child.kill(); reject(new Error('output too large')); return; }
      out += d;
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 400)}`));
      else resolve(out);
    });

    child.stdin.on('error', () => { /* closed early — the close handler reports */ });
    child.stdin.end(input);
  });
}

/** Anthropic Messages API. Cheapest per card; needs ANTHROPIC_API_KEY. */
export function anthropicClient({
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = 'claude-haiku-4-5-20251001',
  maxTokens = 8000,
} = {}) {
  if (!apiKey) return null;
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };

  async function complete(system, user) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    usage.calls++;
    usage.inputTokens += j.usage?.input_tokens || 0;
    usage.outputTokens += j.usage?.output_tokens || 0;
    return (j.content || []).map((b) => b.text || '').join('');
  }
  complete.usage = usage;
  complete.label = `anthropic:${model}`;
  return complete;
}

/**
 * The local `claude` CLI. No key, uses the existing login.
 *
 * The prompt goes in on stdin, not argv: a batch is tens of kilobytes and
 * Windows argv limits would truncate it silently.
 */
export function claudeCliClient({ model = 'haiku', timeoutMs = 300_000 } = {}) {
  const usage = { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };

  async function complete(system, user) {
    // The system prompt goes on STDIN, not argv. On Windows `claude` is a .cmd
    // shim so spawn needs a shell, and a shell concatenates argv without
    // escaping — a multi-line prompt full of quotes and braces gets mangled and
    // the model returns something unparseable. Only simple flags go in argv.
    const stdout = await run(
      'claude',
      ['-p', '--model', model, '--output-format', 'json'],
      `${system}\n\n${user}\n`,
      { timeoutMs },
    );
    let j;
    try {
      j = JSON.parse(stdout);
    } catch {
      return stdout; // older CLI shapes still print plain text
    }
    if (j.is_error) throw new Error(`claude cli: ${j.result || 'error'}`);
    usage.calls++;
    usage.costUsd += j.total_cost_usd || 0;
    usage.inputTokens += j.usage?.input_tokens || 0;
    usage.outputTokens += j.usage?.output_tokens || 0;
    return j.result ?? '';
  }
  complete.usage = usage;
  complete.label = `claude-cli:${model}`;
  return complete;
}

/** Deterministic stand-in so the judge is testable without spending anything. */
export function fakeClient(replies) {
  const queue = Array.isArray(replies) ? [...replies] : [replies];
  const seen = [];
  async function complete(system, user) {
    seen.push({ system, user });
    if (!queue.length) throw new Error('fakeClient: no reply queued');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(system, user) : next;
  }
  complete.seen = seen;
  complete.label = 'fake';
  return complete;
}

/** Pick the cheapest backend that is actually available. */
export function autoClient(opts = {}) {
  return anthropicClient(opts) || claudeCliClient(opts);
}
