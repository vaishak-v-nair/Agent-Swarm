---
type: session
project: AgentSwarm
date: 2026-07-30
source: "~/.claude/projects/E--agent-swarm/ae3a9871-012b-4553-be3c-6b4b72104aa6.jsonl (5.9 MB)"
tags: [session, reset, pivot]
---

# S2 — The Concept Reset

*2026-07-30. The engineering review finished, and then the whole thing was rejected and rebuilt.*

## The four-item docket, cleared

The engineering review closed its open questions first:

- **Gate logic rebuilt.** Three independent thresholds instead of one, plus a stop node so "the built-in tools are enough, build nothing" became a recordable verdict.
- **Build split.** A hooks-only notifier first, the transcript-reading board second, gated on evidence.
- **Test scope re-priced.** The claim that fixture tests double as a version canary was retracted — frozen fixtures cannot detect a *new* version's drift.
- **Ownership retired.** A live check of what the vendor shipped found parallel sessions, automatic per-session git worktrees, and in-app approve/deny — all Windows-native. The plan's own kill criterion fired on its own evidence, and that scope was dropped rather than raced.

## The rejection

Then, in one message:

> "No, we are outside the topic. i want app which can customize claude code terminal, optimized, automation, something new concept, etc. You are also bringing up praxis into this. This is a complete new concept."

This is the most important moment in the project's history. Three review cycles, each individually sound, had optimized a terminal into a smoke alarm. Every narrowing had evidence behind it. The sum had lost the thing that was actually wanted.

Two corrections were made: the concept was restored, and PRAXIS was written out of AgentSwarm's identity entirely.

## What replaced it

**A terminal built for agentic coding.** Not a dashboard beside a terminal (the third-party field). Not a chat app instead of a terminal (the vendor). The terminal itself, rebuilt around the agent.

Four pillars: it **understands** (semantic timeline, tool calls as cards, real diffs), it is **fast** (GPU rendering, input decoupled from output), it **automates** (session recipes, permission profiles), and it is a **cockpit** (panes that know every pane is an agent).

The architectural idea that makes it honest: run the real interactive session in a real terminal pane, *and* read the structured transcript alongside it. The semantic view renders from data, never from scraping the screen. The original toggle — raw execution ⇄ plain English — becomes a lens over the same live session.

Crucially, the review's findings were **kept as engineering notes rather than as constraints**. The hook quirks, the WSL fix, the fixture discipline all survived. Only their authority over the concept was removed.

## Then a second product appeared

Later the same day, a different question: find an idea that could win against Obsidian.

The diagnostic went somewhere unexpected. Asked where knowledge is actually looked for, the honest answer included AI chat histories and `grep` — not the note vault. The vault had already lost.

That produced **Recall**: refine work exhaust (agent transcripts, commits) into knowledge cards that answer questions with receipts. A cold read then disproved its central claim with named competitors, the claim was rewritten narrower, and the correction was accepted on the spot.

Recall became a separate product with its own vault. See `E:\Recall\Recall Vault`.

## What S2 established

- The vision belongs to the builder. Review machinery serves it; it does not get to replace it.
- Evidence from a rejected plan is still evidence.
- Two products now compete for the same eight hours a week — which is what S3 had to solve.

Next: [[S3 - Evidence Before Code]]
