// Where the thinking happens — and what it costs.
//
// The cost picture, stated plainly because it is easy to get backwards:
//
//   claude CLI    OAuth -> draws on the Claude Max SUBSCRIPTION. Measured
//                 $0.0221 for a 10-token prompt, because every call ships ~24k
//                 tokens of Claude Code's own system prompt.
//   Anthropic API ANTHROPIC_API_KEY -> a SEPARATE pay-per-token account. It
//                 does not touch the subscription. ~$2.65 for the full corpus.
//   OpenAI-compat any base URL + key: Groq, DeepSeek, OpenRouter, Together,
//                 LM Studio. Bring the cheapest key you have.
//   ollama        LOCAL. Free. No key, no network, nothing leaves the machine.
//
// Ollama speaks the OpenAI chat-completions shape, so one client covers it and
// every hosted OpenAI-compatible provider. That is why there are three clients
// here and not seven.
//
// Config lives in <home>/.recall/config.json so a key can be pasted once
// instead of exported into every shell. Env vars still win when present.
//
// RECALL_HOME moves that directory off the home drive. On this machine the
// home directory is on C: while every project lives on E:, and the store grows
// without bound as sessions accumulate — so where it lands is a real decision,
// not a detail.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { claudeCliClient, anthropicClient, fakeClient } from './clients.js';

export const RECALL_HOME =
  process.env.RECALL_HOME || path.join(os.homedir(), '.recall');

export const CONFIG_PATH = path.join(RECALL_HOME, 'config.json');

export const PRESETS = {
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'qwen3:4b', keyEnv: null, free: true },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyEnv: 'GROQ_API_KEY' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyEnv: 'DEEPSEEK_API_KEY' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct', keyEnv: 'OPENROUTER_API_KEY' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyEnv: 'TOGETHER_API_KEY' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyEnv: 'OPENAI_API_KEY' },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model', keyEnv: null, free: true },
};

export function readConfig(file = CONFIG_PATH) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export function writeConfig(patch, file = CONFIG_PATH) {
  const next = { ...readConfig(file), ...patch };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The file may hold an API key, so keep it out of anything world-readable and
  // say so in the file itself.
  fs.writeFileSync(file, JSON.stringify({ _comment: 'may contain an API key — keep private', ...next }, null, 2));
  try { fs.chmodSync(file, 0o600); } catch { /* best effort on Windows */ }
  return next;
}

/**
 * OpenAI-compatible chat completions. Covers Ollama and every hosted provider
 * that speaks the same shape.
 */
export function openAiCompatClient({
  baseUrl, model, apiKey = null, timeoutMs = 300_000, json = true, schema = null,
} = {}) {
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

  async function complete(system, user) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0,          // extraction is not a creative task
          stream: false,
          // Small models do not reliably obey "return only JSON". Measured on
          // qwen3:4b: plain prompting produced a three-paragraph essay, and
          // json_object mode produced valid JSON of the WRONG SHAPE —
          // {"response": "<essay>"}. Syntax was never the problem; structure
          // was. A schema constrains decoding to the shape itself, which is
          // what makes a small local model usable at all.
          ...(schema
            ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } } }
            : json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`${baseUrl} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      usage.calls++;
      usage.inputTokens += j.usage?.prompt_tokens || 0;
      usage.outputTokens += j.usage?.completion_tokens || 0;
      let text = j.choices?.[0]?.message?.content ?? '';
      // Reasoning models (qwen3, deepseek-r1) emit a <think> block first. It is
      // not the answer and it breaks JSON extraction if left in.
      return String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    } finally {
      clearTimeout(timer);
    }
  }
  complete.usage = usage;
  complete.label = `${new URL(baseUrl).hostname}:${model}`;
  complete.free = /localhost|127\.0\.0\.1/.test(baseUrl);
  return complete;
}

/**
 * Build the configured backend.
 *
 * Order: explicit config -> a key that happens to be in the environment ->
 * a local Ollama if it is actually up -> the CLI as the last resort, because
 * it is the one that spends the subscription.
 */
export async function resolveClient(opts = {}) {
  const { config = readConfig(), probe = true } = opts;
  const name = config.provider;

  if (name === 'fake') return fakeClient(config.replies || ['[]']);
  if (name === 'claude-cli') return claudeCliClient({ model: config.model || 'haiku' });
  if (name === 'anthropic') {
    const c = anthropicClient({ apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY, model: config.model });
    if (c) return c;
  }
  if (name && PRESETS[name]) {
    const p = PRESETS[name];
    const key = config.apiKey || (p.keyEnv && process.env[p.keyEnv]) || null;
    if (p.keyEnv && !key) throw new Error(`provider "${name}" needs a key — run: recall config --provider ${name} --key <KEY>`);
    return openAiCompatClient({ baseUrl: config.baseUrl || p.baseUrl, model: config.model || p.model, apiKey: key, schema: opts.schema });
  }
  if (name === 'custom') {
    return openAiCompatClient({ baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey || null });
  }

  // ---- nothing configured: pick the cheapest thing that actually works -----
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  for (const [n, p] of Object.entries(PRESETS)) {
    if (p.keyEnv && process.env[p.keyEnv]) {
      return openAiCompatClient({ baseUrl: p.baseUrl, model: p.model, apiKey: process.env[p.keyEnv] });
    }
  }
  if (probe && (await ollamaUp())) {
    const model = await bestOllamaModel();
    return openAiCompatClient({ baseUrl: PRESETS.ollama.baseUrl, model, schema: opts.schema });
  }
  return claudeCliClient({ model: config.model || 'haiku' });
}

export async function ollamaUp(baseUrl = 'http://localhost:11434') {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Prefer a mid-size instruct model: big enough to follow a strict JSON schema,
 * small enough to finish a batch this decade on CPU. A 36B MoE is more capable
 * but minutes per call; extraction is a volume job.
 */
export async function listOllamaModels(baseUrl = 'http://localhost:11434') {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    const j = await res.json();
    return (j.models || []).map((m) => ({ name: m.name, size: m.size || 0 }));
  } catch {
    return [];
  }
}

/**
 * Is this model big enough to judge faithfully?
 *
 * MEASURED, not assumed. qwen3:4b with schema-constrained decoding returns the
 * right SHAPE but cannot do the job: across two runs it judged 1 of 3
 * candidates, invented an id that was never given to it, paraphrased its own
 * quote (caught by the faithfulness gate), and produced **zero** publishable
 * cards — at ~110s per candidate, which is ~54 hours for a full backfill.
 *
 * Extraction needs the model to hold several long candidates, copy a span
 * character-exact, and refuse most of them. Small models fail the copying part
 * first, and a paraphrased quote is precisely the wrong receipt this product
 * exists to prevent. So: warn loudly rather than let someone discover it after
 * an overnight run.
 */
export function judgeCapability(label = '') {
  const l = String(label).toLowerCase();
  if (!/localhost|127\.0\.0\.1/.test(l)) return { ok: true };
  const m = l.match(/[:\-](\d+(?:\.\d+)?)b\b/);
  const billions = m ? parseFloat(m[1]) : null;
  if (billions !== null && billions < 12) {
    return {
      ok: false,
      why: `${label} is a ~${billions}B local model. Measured on this corpus it produced 0 usable cards: it drops candidates, invents ids, and paraphrases quotes instead of copying them.`,
      fix: 'Use a bigger local model (ollama pull qwen3.6), or a cheap hosted one — Groq has a free tier: recall config --provider groq --key gsk_…',
    };
  }
  return { ok: true, slow: true };
}

export async function bestOllamaModel(baseUrl = 'http://localhost:11434') {
  const models = await listOllamaModels(baseUrl);
  if (!models.length) return PRESETS.ollama.model;
  const GB = 1024 ** 3;
  const usable = models.filter((m) => m.size > 1.2 * GB && m.size < 12 * GB);
  const pick = (usable.length ? usable : models).sort((a, b) => b.size - a.size)[0];
  return pick.name;
}
