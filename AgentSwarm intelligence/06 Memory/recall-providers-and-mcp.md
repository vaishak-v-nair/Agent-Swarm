---
name: recall-providers-and-mcp
description: "Recall runs on free local inference and is wired into Claude Code via MCP — the AgentSwarm + Recall join, plus the billing fact that the claude CLI (not the API key) spends the subscription"
metadata: 
  node_type: memory
  type: project
  originSessionId: ec6d305e-1454-4370-818c-3ad006822180
  modified: 2026-08-03T15:45:50.418Z
---

## The billing fact Vaishak had backwards

He believed setting `ANTHROPIC_API_KEY` would drain his Claude subscription.
**It is the opposite.**

- `claude` CLI authenticates by OAuth and **spends the Claude Max
  subscription** — measured $0.0221 for a *10-token* prompt, because every
  invocation ships ~24k tokens of Claude Code's own system prompt.
- `ANTHROPIC_API_KEY` bills a **separate** pay-per-token account
  (console.anthropic.com). It never touches the subscription. ~$2.65 for the
  full corpus.
- **ollama is free**, local, offline.

So the zero-setup path was the expensive one. Correct this if it comes up again.

## Providers — `E:/Recall/recall/src/providers.js`

Ollama speaks the OpenAI chat-completions shape, so ONE client covers local
inference *and* Groq / DeepSeek / OpenRouter / Together / OpenAI / LM Studio.

    recall config                              # shows what is available and what is free
    recall config --provider ollama            # free
    recall config --provider groq --key gsk_…  # paste once, no env vars

Config at `~/.recall/config.json` (chmod 600). Env vars still win. With nothing
set, the resolver picks the cheapest working option: env key -> running Ollama
-> CLI last, because the CLI is the one that spends the subscription.

**Free inference is wired but a 4B model CANNOT do the judging.** Measured, not
assumed — `qwen3:4b` through three escalating fixes:

1. plain prompt → a three-paragraph essay picking its favourite candidate
2. `response_format: json_object` → valid JSON of the **wrong shape**,
   `{"response":"<essay>"}` — syntax was never the problem, structure was
3. **JSON Schema constrained decoding** → correct shape at last, and then it
   judged 1 of 3 candidates, **invented an id**, and paraphrased its own quote
4. schema + batch size 1 → still **0 cards**, ~110s per candidate (~54h backfill)

Extraction needs a model that can hold several long candidates, copy a span
character-exact, and refuse most of them. Small models fail the *copying* first,
and a paraphrased quote is the wrong receipt this product exists to prevent —
the faithfulness gate caught it every time, which is the system working.

So `recall index` **refuses a sub-12B local model** (`judgeCapability`) and says
why before the run, not after. `--force` overrides. Realistic cheap paths:
**Groq free tier**, DeepSeek (~$0.14/M), or `ollama pull qwen3.6` if patient.
Keep schema-constrained decoding regardless — it is what makes any smaller
hosted model usable.

**Two things local models broke:** a model asked for an array of one returns the
bare object (`{"id":…}` not `[{"id":…}]`) — reject that and a whole batch dies
over two brackets; and reasoning models emit a `<think>` block whose braces
defeat JSON extraction. Both handled in `parseReply` and the client.

## AgentSwarm + Recall — `bin/recall-mcp.js`

MCP server over stdio, **registered and connected**:

    claude mcp add recall -- node E:/Recall/recall/bin/recall-mcp.js

Verified against a live Claude Code session, which called `recall_stats` and
returned real store numbers. Every AgentSwarm pane is a Claude Code session, so
every pane now has memory of every past session, with receipts.

Tools: `recall_search`, `recall_why`, `recall_stats`. **Read-only on purpose** —
memory an agent can silently write to is memory you cannot trust, so extraction
stays a deliberate audited step.

Two behaviours to preserve: an empty result is phrased so the agent *proceeds
from first principles* rather than assuming the tool broke; and contradictions
are handed over unresolved with both ids, because the human decides.

Docs: `Recall Vault/03 Plans/P7 - AgentSwarm + Recall, and free inference.md`.
71 tests across both packages. See [[recall-core-built]].
