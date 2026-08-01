---
tags: [research, competitive]
date: 2026-08-01
source: https://github.com/yc-software/qm
method: cloned and read
---

# R2 — QM, read in full

Supersedes the secondhand parts of [[R1 - QM and What It Means For Us]]. This one
is from the source: cloned at depth 1 and read.

## What it actually is

| | |
|---|---|
| licence | MIT |
| language | TypeScript on Node ≥ 24.15, Fastify for HTTP |
| size | 1,264 tracked files |
| **source** | **342 `.ts`** |
| **tests** | **392 `.ts`** — more test files than source files |
| plugins | 203 files · CLI 109 · skills-seed 79 |

A **headless core** with Postgres for sessions, memory and a queue. Every turn
runs through that core. The web UI, admin panel and public portal are *optional
plugins over the core's HTTP API*; Slack is an optional in-process plugin. Web UI
is Vite + Lit.

Each person and each room gets its own scoped memory, files, keychain view,
permissions, crons, web apps and **durable sandbox** — a computer where installed
tools stay installed. The agent has a small fixed tool surface, and one of those
tools is `execute`, which runs commands in that sandbox.

Everything company-specific lives in a **deployment directory** the `qm` CLI
validates and deploys. Every substrate — harness, session store, sandbox, memory
— sits behind an interface, swapped in via one wiring file.

## The finding that changes my earlier assessment

**QM drives agents through SDKs, not CLIs.**

```
@anthropic-ai/claude-agent-sdk   0.3.211
@openai/codex                    0.144.5
@opencode-ai/sdk                 1.17.18
@earendil-works/pi-ai            0.82.0
```

`claude-harness.ts` imports `query()` from the Claude Agent SDK. There is no
terminal anywhere in a QM agent's life. It is a *server* that runs agent turns
programmatically and renders them into Slack and a web app.

In R1 I wrote that "a QM agent could reasonably run inside an AgentSwarm pane."
**That was wrong**, and it was wrong because I had only read a tweet. You do not
run QM in a pane; you deploy it. Adding a `qm` profile in M11 was still the right
change — it removed a real limitation — but it is not the integration I implied.

## The harness contract

The abstraction their "not tied to any single vendor" claim rests on:

```ts
export interface Harness {
  profile: HarnessAdapterProfile;
  turns:   HarnessTurnController;   // runTurn, close, resetSession
  models:  HarnessModelUtilities;   // all optional
  tools:   HarnessToolPresentation; // renames core tools per harness
}
```

`HarnessModelUtilities` is entirely optional capabilities: `shouldRespond`,
`compactHistory`, `contextTokenBudget`, `oneShot`, `judge`, `screenSecurity`,
`pickAckEmoji`, `generateTitle`, `summarizeApproval`. `defineHarness` binds
whatever an implementation provides and omits the rest.

**That is the pattern worth stealing.** Not "every harness implements everything",
but "a harness declares what it can do, and the core degrades where it cannot."

Memory follows the same shape — `MemoryStrategy` with optional `onTurnEnd`,
`maintain`, `promptLines`, and four implementations: `per-turn` (default),
`scratch-promote`, `agent-only`, `consolidation`.

## Do we compete? No — and not the way I said

| | QM | AgentSwarm |
|---|---|---|
| shape | a deployed server | a desktop app |
| agent runs | via SDK, headless | as a CLI in a PTY |
| surface | Slack + web | a terminal you type into |
| scope | a company, many people | one person, many sessions |
| state | Postgres | files in `.agentswarm/` |

QM replaces *the agent*. AgentSwarm replaces *the terminal the agent runs in*. A
QM user has no terminal to improve; an AgentSwarm user is deliberately sitting in
one.

## Should we adopt it?

**No — not for AgentSwarm.** It is a Postgres-backed multi-tenant server for a
company with Slack. AgentSwarm is a single-user Windows desktop app. Adopting QM
would not make AgentSwarm better; it would make it a different product.

It is worth a separate look for the *global* project — a company brain with
connectors, crons and shared skills is a real thing and it is MIT — but that is a
different decision from this one, and it should be its own note.

## The three things worth stealing

1. **Capability-declaring adapters.** M11 made profiles a command string. QM's
   harness contract shows the better shape: a profile declares what it supports —
   *does it write a transcript, and where* — so the semantic layer can attach to
   anything that can answer, instead of being hard-wired to `claude`.

2. **More test files than source files.** 392 vs 342. AgentSwarm has 28 Rust and
   26 JS tests against a much smaller codebase, and the tests that exist have
   repeatedly caught real bugs. The ratio is the discipline, not the count.

3. **Everything specific outside the core.** QM's deployment directory keeps
   company config, tools, skills and infrastructure out of the engine.
   AgentSwarm's equivalent is `.agentswarm/`, which already holds swarms,
   settings and layout — the principle is right and the boundary could be
   sharper.

See [[R1 - QM and What It Means For Us]] · [[B11 - M11 Any Agent]] · [[P4 - Milestones]]
