---
type: session
project: AgentSwarm
date: 2026-07-31
source: "~/.claude/projects/E--agent-swarm/7e015ca2-f109-4f04-9752-6d67ef375631.jsonl (5.2 MB)"
tags: [session, evidence, audit]
---

# S3 — Evidence Before Code

*2026-07-31. Three checks against reality. Two beliefs died.*

## Check 1 — the prior-work audit

*Question: is Recall a rebuild of PRAXIS, which is already shipped?*

A source-level inventory of PRAXIS v0.10.1 (96 commits in 16 days, published, 294 tests) found:

| Recall needs | PRAXIS has |
|---|---|
| Transcript parsing | ✅ shipped and tested |
| Hooks, redaction, vault writing, commit join | ✅ all shipped |
| **LLM extraction of knowledge** | ❌ none — memory is a fixed template |
| **Searchable store** | ❌ no database, no index |
| **Question answering** | ❌ the entire recall API dumps a markdown file |

**Verdict: separate products, shared plumbing.** PRAXIS proves what the AI did. Recall remembers why. Neither crosses into the other. The overlapping code gets extracted once and used by both.

## Check 2 — does the demo's knowledge actually exist?

The Recall demo was built on recovering *approaches abandoned mid-session*. Nobody had checked whether that is written down in real transcripts.

25 sessions, 532 error pivots, 90 windows classified:

- **Abandonment: 1 unique real event in 90 windows.** Only 3.2% of error pivots are verbalised. The evidence lives in tool-call chains, not prose.
- **Gotchas: 50% of everything extractable**, and the only card type that surfaced from detectors built to find something else.

The hero card changed from abandonment to gotchas. A second finding was equally important: keyword matching **inverted on negation** — a sentence saying nothing was abandoned scored as an abandonment. Regex was demoted to a candidate finder; the model does the judging.

Three weeks of building toward an empty demo were avoided by an afternoon of measurement.

## Check 3 — the competitive recon

The claim under test: *nobody refines work exhaust into human answers.*

**It is false.** Repowise (4.4k stars) mines Claude Code transcripts into decision records with rationale and supersession, and cites its answers. Decispher claims an almost identical design. scribe and Bitloops do versions of it. Two funded players are closing from opposite ends: one owns the substrate and lacks the refinery, the other owns the answering layer and lacks the transcripts.

What survived the recon: **provenance depth and ingest breadth.** Every competitor cites shallowly — a file path, a channel and date, an app and a time window, or nothing at all. Citing to the exact transcript line *and* the commit, from both transcripts and git, is unoccupied by anyone credible.

The claim has now been rewritten twice and is narrower and checkable each time.

Also corrected: a tool that had been treated as a threat turned out, by its own documentation, to have no memory of past coding sessions, git history, or decisions. It came off the list.

## The instrumentation problem

Preparing the evidence week surfaced a trap. The week measures "living on the built-in notification tools" — but an inventory found notifications were **never configured**. Five days would have measured silence and concluded the built-ins were useless.

Four settings were configured and verified, and one honest limit was recorded: the configuration can be verified by tooling, but **delivery cannot** — an agent shell runs detached from the terminal and cannot see a taskbar or a phone. That test stays with the human.

## The allocation problem

Two products, one eight-hour week, both with clocks running. A split would double every date in both plans.

**Resolution:** both evidence packets run this week (they cost almost no build hours), then one project takes 100% of the build hours and the other freezes with plans intact.

## What S3 established

- Measure the signal before building the extractor.
- Audit competitors by their citation format, not their marketing.
- A claim that dies twice is still worth keeping if each rewrite is narrower and true.
- The instruments that measure a week must themselves be verified before the week starts.

Back to: [[S0 - Conversation Arc (index)]]
