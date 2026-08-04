---
tags: [build, m4, mcp, providers, agentswarm]
built: 2026-08-03
status: live — registered and verified against a real Claude Code session
---

# AgentSwarm + Recall, and getting off the subscription

Two upgrades. 71 tests across both packages.

## 1. The cost correction that changes everything

**`ANTHROPIC_API_KEY` does not spend the Claude subscription.** They are
separate billing paths, and it is easy to believe the opposite:

| backend | pays from | measured |
|---|---|---|
| `claude` CLI (OAuth) | **the Claude Max subscription** | $0.0221 for a 10-token prompt — every call ships ~24k tokens of Claude Code's own system prompt |
| `ANTHROPIC_API_KEY` | a separate pay-per-token API account | ~$2.65 for the full corpus |
| **ollama** | **nothing** | free, local, offline |

So the CLI — the thing that needed no setup — was the expensive one.

### The provider layer

`src/providers.js`. Ollama speaks the OpenAI chat-completions shape, so **one
client covers local inference and every hosted provider**: Groq, DeepSeek,
OpenRouter, Together, OpenAI, LM Studio.

```bash
recall config                                  # what is available, and what is free
recall config --provider ollama                # free, local, nothing leaves the machine
recall config --provider groq --key gsk_…      # paste a key once, no env vars
```

Config lives in `~/.recall/config.json`, chmod 600, so a key is pasted once
rather than exported into every shell. Env vars still win when set. With nothing
configured the resolver picks **the cheapest thing that actually works**: an
env key, then a running Ollama, and only then the CLI.

### Free inference: wired, and NOT good enough at 4B

Honest result, measured rather than assumed. `qwen3:4b` was taken through three
escalating fixes and still cannot do this job:

| attempt | outcome |
|---|---|
| plain prompt | a three-paragraph essay recommending its favourite candidate |
| `response_format: json_object` | valid JSON of the **wrong shape** — `{"response": "<essay>"}` |
| **JSON Schema constrained decoding** | correct shape at last, and then: judged 1 of 3 candidates, **invented an id**, paraphrased its own quote |
| schema + batch size 1 | still 0 cards, ~110s per candidate |

**Zero publishable cards across every configuration.** Syntax was never the
problem; structure was, and once structure was forced, capability was.

The lesson generalises: extraction needs a model that can hold several long
candidates, copy a span character-exact, and refuse most of them. Small models
fail the *copying* first — and a paraphrased quote is exactly the wrong receipt
this product exists to prevent. The faithfulness gate caught it every time,
which is the system working.

At ~110s per candidate a full backfill would take **~54 hours**. So:

- **`recall index` now refuses a sub-12B local model** and says why, before the
  run rather than after it. `--force` overrides.
- Realistic cheap paths: **Groq's free tier**, DeepSeek (~$0.14/M input), or
  `ollama pull qwen3.6` locally if you are patient.

Schema-constrained decoding stays regardless — it is what makes any smaller
hosted model usable.

### Two things local models broke

1. **A model asked for an array of one returns the bare object.** qwen3:4b
   replied `{"id":"a","card":null}`. Rejecting that throws away a whole batch
   over two missing brackets. `parseReply` now accepts it, and `{"results":[…]}`.
2. **Reasoning models emit a `<think>` block first**, and its braces defeat
   every JSON-extraction heuristic. Stripped in both the client and the parser.

## 2. The join: AgentSwarm + Recall

`bin/recall-mcp.js` — an MCP server over stdio. **Registered and connected:**

```bash
claude mcp add recall -- node E:/Recall/recall/bin/recall-mcp.js
# recall: ✔ Connected
```

Verified against a live Claude Code session, which called `recall_stats` and
returned `62 cards / receipt integrity: 62/62 verify` — real numbers out of the
real store.

### Why this is the right shape for the join

AgentSwarm runs many agents and **every one of them starts from a blank
context**. The expensive thing is not thinking; it is re-deriving what was
already settled weeks ago in a pane that has since been closed. An agent that
can query the store stops re-deriving, and the human watching that pane sees the
receipt and can check it.

Three tools, all **read-only on purpose** — memory an agent can silently write
to is memory you cannot trust, so extraction stays a deliberate, audited step:

| tool | for |
|---|---|
| `recall_search` | find prior gotchas/decisions/solutions, with commit + transcript locators |
| `recall_why` | the full receipt chain for one card, before acting on it |
| `recall_stats` | what is in the store, and whether its receipts verify |

Two deliberate behaviours worth keeping:

- **An empty result is phrased so an agent proceeds** rather than retrying:
  *"this subject is genuinely absent, so proceed from first principles rather
  than assuming memory failed."*
- **Contradictions are handed over unresolved**, with both ids, because the
  agent — or the human — should decide, not the retrieval layer.

## What this unlocks next

The cockpit can surface the same store the agents query: a pane that shows "3
cards match what you are doing" while you work. That is the cross-product
surface the CEO review deferred, and its entry condition (Recall M2 + cockpit
M1) is now the only thing between here and it.

## Standing caveat

[[P2 - Gates|Gate 2]] is still open with its STOP condition, and the baseline
week still has zero entries. The engine runs, it is free to run, and agents can
reach it. None of that is evidence anyone needs it.
