---
tags: [research, competitive, recall]
---

# Converger Recon — 2026-07-30

*Packet B item 3. Capability audit from source, docs, GitHub API, and release history. What it does NOT cover: the felt experience of installing and living with these tools — that judgment still needs your hands.*

## 1. claude-mem — far bigger than we assumed, and already has our taxonomy

**89,042 stars. 11 releases in 23 days. Created Aug 2025.** This is not a side project; it is the category winner for agent-context memory.

**It already extracts what we planned to extract.** Its schema (`plugin/modes/code.json`) has `decision` as a first-class type and `gotcha` as a first-class concept value. LLM extraction, real structured output, SQLite + FTS5 + Chroma.

**But its output is built for the model, not the human:**
- **No human search UI.** The web viewer's component tree contains no Search, Filter, or Query component — it is an SSE feed with a project dropdown. There is no `/api/search` endpoint. All search is MCP-only, i.e. you must ask Claude to search your own memory.
- **No provenance.** Session-id and file-path granularity only. No transcript line, no message UUID, no commit SHA. A "show me the receipt" workflow is unsupported.
- **No git integration whatsoever.** Project identity is `basename(cwd)`, and an open issue (#3437) reports 26% of one maintainer's store is misattributed because of it.
- **No Obsidian/vault integration; no markdown export** (JSON export via a raw script only).
- Search is semantic-first with a keyword fallback — *not* the fused hybrid the README claims.

**Kill-condition status: NOT triggered.** Zero roadmap signal toward human query, search UI, or provenance across issues, discussions, and releases. Maintainer's July attention is entirely worker reliability, Windows performance, telemetry, and paid cloud sync. **Leading indicators to watch: a Search component in `src/ui/viewer/components/`, or a `/api/search` endpoint.**

## 2. The Obsidian import space — weak incumbent, one real player

**Claude Code Sync (the one we named) is trivially weak:** 0 stars, 215 downloads, ~19 KB of TypeScript, no LLM, no provenance, no git, functionally unchanged since 1.0.1 (July 10). It doesn't even read `gitBranch`, which sits in the JSONL for free.

**The real incumbent is `claude-sessions` (gapmiss)** — 767 downloads, actively developed, and it holds **three of four pieces**: BM25 cross-session search, Bases dashboards, and the ecosystem's only genuine receipt primitive — turn-level deep links (`obsidian://claude-sessions?session=...&turn=7`). Its extraction is a *manual clipboard round-trip*: run `/distill` in Claude Code, copy, switch apps, merge. **If gapmiss automates that loop, he closes most of the gap.**

**Nothing in the Obsidian directory runs an LLM over transcripts to produce structured knowledge.** The plugins with distribution (Copilot 1.6M, Smart Connections 1.1M) pull *agents into the vault*; they don't turn *sessions into knowledge*. Combined downloads of the two genuine session-import plugins: ~982.

## 3. screenpipe is not in this race

Their own docs settle it: the Claude Code integration *"does not provide memory of past coding sessions, git history, or previous decisions."* No code/commit awareness, no vector search, no automatic knowledge extraction, no citations in any answer surface. 20.6k stars and shipping daily — but it is a screen-and-audio work ledger, a different product in a different category. **Remove from the threat list.**

## 4. The premise-2 verdict: the refinery claim is now literally false

Named competitors that do approximately what Recall proposed:

| Who | Shape | Weight | The gap they leave |
|---|---|---|---|
| **Repowise** (4.4k★, AGPL, $15/mo) | Mines Claude Code transcripts into decision records with rationale, alternatives, supersession, verification status; `get_answer` synthesizes + cites | Real | **Citations are file paths only** — no commit SHA, no line, no session id. Homepage contradicts its own docs about transcript ingestion. |
| **Decispher** (decispher.com) | Spec-identical: 7 decision types, SUPERSEDES edges, "no source, no claim" | **Zero third-party verification** — no founders, funding, pricing, launch date, or press | Citations are `#channel · date`; **discards raw source text**; live sources are Slack/GitHub/Jira, agents are consumers not sources |
| **scribe** (54★) | Best provenance in the field: session IDs + commit SHAs + timestamps per entry | Hobby scale | Returns pre-synthesized wiki articles, not per-query synthesis |
| **Bitloops** | Checkpoints **cryptographically bound to commit hash** | No disclosed team/funding | Structured capture at session time, not post-hoc extraction |

**And two heavyweights are converging from opposite directions:**
- **Entire** — $60M seed, ~$300M valuation, Thomas Dohmke (ex-GitHub CEO). Session transcripts as first-class git objects (`entire/checkpoints/v1`), line-level agent-vs-human attribution. Thesis: *"Session logs are now the second most important artifact in software development, and they belong in the repository."* **Has the substrate, lacks the refinery.**
- **Unblocked** — $20M Series A. 25+ sources, *"every answer links back to the exact sources it consulted,"* human surfaces everywhere. **Has the answering layer, lacks agent transcripts** (adding them is a roadmap item, not a rebuild).

**Anthropic's kill condition: still NOT met.** Claude Code auto-memory stores flat conclusions with no provenance and no human query surface; `search_session_transcripts` exists but is Desktop-only, undocumented, substring-match, one hit per session, model-facing, approval-gated per call, 30-day retention, no commit linkage. The audit primitive (`memver_…`) is API-only beta; Dreams (transcript mining) is a gated preview that deliberately synthesizes **without** citations.

## The honest verdict

**The literal premise 2 is dead** — "nobody does this" is false. But the field is bimodal: *right shape, no weight* (scribe, Varve, workshop, Bitloops, Decispher-if-real) or *weight, wrong shape* (Unblocked, Pieces, Entire, claude-mem).

**Two structural weaknesses recur across the ENTIRE field, and they are the actual defensible ground:**

1. **Provenance depth.** Almost everyone cites a file path or a channel+date. Repowise: file paths only. Decispher: `#channel · date`, raw text discarded. Pieces: app name + time window. mem0: no source field at all. **Only scribe and Bitloops do commit-SHA-and-session-level provenance, and both are hobby-scale.**
2. **Ingest breadth.** Nearly everything consumes *either* transcripts *or* git/PRs/chat — never both, credibly.

**The window is visibly closing from two directions.** Unblocked needs a substrate; Entire needs a refinery. Either could cross in one release cycle.

## What this changes

- Premise 2 needs its third rewrite — from "nobody refines" to a provenance-depth claim, or Recall needs a different position entirely.
- The named kill conditions should be re-pointed: **claude-mem shipping viewer search**, **gapmiss automating `/distill`**, **Unblocked adding transcripts**, **Entire shipping extraction**. screenpipe comes off the list.
- Strategically relevant to the tournament: AgentSwarm's category (agent-aware terminal) has *no* funded convergers; Recall's has four plus two heavyweights.
