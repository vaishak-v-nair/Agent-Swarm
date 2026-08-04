---
tags: [gates]
---

# Gates — what has to be true before anything gets built

Nothing here is a guess. Every number was written down before the data existed.

## Gate 1 — the prior-work audit ✅ CLEARED 2026-07-30

*Question: is Recall just a rebuild of PRAXIS?*

**Answer: no.** PRAXIS has no extraction, no store, no search — its whole recall API dumps a markdown file. Recall's entire product is the hole in PRAXIS. But the plumbing overlaps a lot, so that plumbing gets shared instead of rebuilt.

**Verdict: separate products, shared organs.** Full detail in the design doc.

## Gate 2 — the tournament (open)

One 8-hour week, two projects, one winner takes all the build hours. The other freezes with plans intact. Decided by the baseline week — see `Tournament Week` in the AgentSwarm vault.

The two dimensions that would send the hours here:

- **T-C (comprehension)** — ≥3 times in 5 workdays where you knew a session finished but still had to scroll to understand what it did. This authorizes digests.
- **T-R (review)** — ≥3 times in 5 workdays where reviewing the output was the bottleneck. This authorizes the review lane.

If both fail and T-A fails too → **STOP.** Write the closure note, build nothing, archive.

## Then, if it wins

- **M1 core** ≈ 4 calendar weeks at 8 hrs/week
- First task inside M1 is **not** code — it is checking that the target knowledge actually exists as text ([[R1 - Signal Probe Results|Signal Probe Results]] already did this once; gotchas won)
- Quality gate: 50 cards sampled, ≥90% of published receipts correct. A wrong receipt is worse than no answer.

## Kill conditions — check these weekly

Any one of these fires, the plan changes:

1. **claude-mem ships a search box.** Watch `src/ui/viewer/components/` for a Search component, or a `/api/search` endpoint. It ships 11 releases in 23 days, so this can land fast.
2. **`claude-sessions` automates its `/distill` step.** That plugin already has turn-level deep links, keyword search, and dashboards. It is three of four pieces.
3. **Unblocked adds agent transcripts.** They have $20M and already cite their answers. For them this is one more connector.
4. **Entire ships extraction.** $60M, ex-GitHub CEO, already owns the substrate. If they add the refinery, they own both halves.

*(screenpipe was on this list and came off — its own docs say it has no memory of past sessions, git history, or decisions.)*
