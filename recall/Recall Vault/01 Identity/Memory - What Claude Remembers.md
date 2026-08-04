---
type: identity
project: Recall
updated: 2026-07-31
source: "~/.claude/projects/E--agent-swarm/memory/recall-memory-design.md"
tags: [memory]
---

# Memory — what Claude carries between sessions

A meta-fact first, because it explains this vault's shape: **Recall has no Claude
project directory of its own.** Its auto-memory lives inside the AgentSwarm project's
memory at `~/.claude/projects/E--agent-swarm/memory/recall-memory-design.md`, because
both products came out of the same conversations. Until Recall wins build hours and
runs sessions in its own directory, that file is the single durable memory — this note
renders it faithfully.

## Durable facts currently held

- **Born 2026-07-30** from an "Obsidian killer" office-hours session; design approved
  at 9/10 after two adversarial rounds, CEO scope review clean. Plan of record:
  `~/.gstack/projects/agent-swarm/vaish-unknown-design-20260730-recall-memory.md`.
- **The working name collides with Windows Recall** — renaming is part of the
  assignment before code (candidates on the record: SHERD · WHYBACK · CITEBOOK, all
  free on npm).
- **The claim died twice, on purpose.** "Nobody ingests work exhaust" was disproven by
  cold read — claude-mem, the Claude Code Sync plugin, Pieces LTM-2, screenpipe. What
  survives is narrower and checkable: the *refinery* — answers cited to the exact
  transcript line and the exact commit, from both transcripts and git. Nobody credible
  does both.
- **Full product B was chosen over the recommended CLI wedge** — the fourth
  complete-vision choice on this builder's record. The response, as always: gates, not
  arguments.
- **Staged milestones:** M1 engine (~4 weeks at 8 h/week with the CEO fix-pack:
  signal-existence probe as the true first task, pre-registered test questions,
  Claude-Code-grepping-its-own-transcripts as the honest baseline, ≥90% receipt
  precision gate, secrets redaction, content-addressed receipts) → M2 daemon → M3 UI →
  M4 MCP agent-side (gated) → M5 trojan Obsidian plugin → M6 importers. Shared parser
  core `recall-core` serves AgentSwarm too.
- **Gate 1 CLEARED (2026-07-30):** the prior-work audit ruled PRAXIS and Recall
  **separate — siblings with shared organs.** The boundary: PRAXIS is *trust* (proves,
  signs, judges — never search-QA); Recall is *memory* (extracts, searches, answers
  with provenance — never signs or judges). Overlapping plumbing (transcript reader,
  redaction, vault writer, commit join) extracted into `recall-core` as M1 step 0.
- **Gate 2 STANDING:** evidence decides the build hours — the remaining Packet B items
  (signal probe, converger recon, naming) feed the tournament against AgentSwarm.
  Standing constraint: 8 hours a week until September.

## A note on accuracy

The memory still contains the *original* M1 demo framing (recovering an abandoned
approach) alongside the correction that replaced it — the signal probe measured 1
abandonment event in 90 windows across 25 real sessions, so **gotchas** became the hero
card. Where the two disagree, [[R1 - Signal Probe Results]] wins; the measurement
outranks the plan it corrected. Memory is point-in-time — verify paths and claims
before acting on them.

Related: [[Recall - Home]] · [[Decision Log]] · [[P1 - The Claim]] · [[P2 - Gates]] · [[S0 - Conversation Arc (index)]]
