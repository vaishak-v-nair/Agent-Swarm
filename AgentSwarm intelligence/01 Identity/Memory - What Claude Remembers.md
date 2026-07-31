---
type: identity
project: AgentSwarm
updated: 2026-07-31
source: "~/.claude/projects/E--agent-swarm/memory/ (4 files) and E:\\agent-swarm\\.praxis\\memory.md"
tags: [memory]
---

# Memory — what Claude carries between sessions

There are three separate memory systems running on this project. They are not the same thing, and confusing them causes real errors.

## 1. Claude Code auto-memory — `~/.claude/projects/E--agent-swarm/memory/`

Written by Claude during sessions, loaded automatically at the start of the next one. Four files:

| File | Holds |
|---|---|
| `MEMORY.md` | The index — one line per memory, loaded every session |
| `agent-swarm-design.md` | This project: the approved plan, the gates, the week-0 assignment |
| `recall-memory-design.md` | The Recall product: its claim, its gates, its audit verdict |
| `user-vaishak-style.md` | How this builder works — a profile, not project facts |

**Known limitation, verified:** these hold conclusions, not reasoning. They say what was decided, not why or what was rejected. That gap is exactly what the `05 Sessions` folder exists to fill — and, not coincidentally, exactly the gap the Recall product is designed to close.

## 2. PRAXIS memory — `E:\agent-swarm\.praxis\memory.md`

Written automatically when a session ends, mirrored into this vault's `Praxis/` folder. Deterministic, not AI-generated: the asks, the files touched, the commits, and the closing words. Older entries archive rather than delete.

## 3. This vault

Hand-written and curated. The only one of the three that keeps reasoning, reversals, and the things that turned out wrong.

## Durable facts currently held

- The approved plan, its gates, and the pre-registered thresholds
- That Approach C (the full product) was chosen against advice, repeatedly and deliberately
- That the lag is a vendor bug (claude-code#41501), not a product opportunity
- That Claude Code hooks announce a prompt appearing but never announce it being answered
- That PRAXIS and Recall are siblings, and where the boundary is
- That the demo's original hero card was measured and replaced

## A note on accuracy

Memory recalled in a later session reflects what was true when it was written. Before acting on any of it — especially a filename, a flag, or a version — check that the thing still exists. Two corrections in this project came from exactly that check.

Related: [[Decision Log]] · [[Working Principles]] · [[How Sessions Are Captured]]
