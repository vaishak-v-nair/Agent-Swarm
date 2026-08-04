---
tags: [build]
---

# Milestones

Nothing starts until the tournament picks a winner. See [[P2 - Gates|Gates]].

## M0 — shared organs (before M1)
Pull `recall-core` out of PRAXIS: transcript reader, redaction, vault writer, commit join. Repackaging code that already works and is already tested. ~half a day.

## M1 — the engine (~4 calendar weeks at 8 hrs/week)
- **First task, before any feature:** check the target knowledge exists as text in real transcripts (done once already — gotchas won, abandonment lost)
- Parse transcripts → extract cards (decisions, gotchas, solutions) → SQLite + full-text search
- **Both locators or the card is not published:** transcript line AND commit SHA
- `recall "question"` → answer built only from retrieved cards, receipts attached
- `recall why <card>` → the full receipt chain. This is the demo nobody else can copy.
- `recall export` → cards into the Obsidian vault, plus one card per day into the daily note
- Redact secrets before any card leaves for the model, and again before export
- Store protection: resumable indexing, content dedup, proper SQLite backup

**Then the polish tail (+1 week):** `recall standup`, `recall stats`, `recall random`, coloured receipts.

## M2 — the daemon (~2–3 weeks)
Watch transcripts and git live. Index as you work.

## M3 — the surface (~4 weeks)
A real UI: browse, timeline, search.

## M4 — the agent side (~2 weeks, gated)
An MCP server so agents query the same store you do. Only after M1's demo and retrieval tests pass.

## M5 — distribution (~3 weeks)
The Obsidian plugin. Lead with **cards that carry receipts**, never with "imports your sessions" — that part is already commoditized.

## M6 — more sources (only on real demand)
Other chat histories. Not before someone outside your head asks for it.
