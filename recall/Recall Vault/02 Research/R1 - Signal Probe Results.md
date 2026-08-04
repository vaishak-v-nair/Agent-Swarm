---
tags: [research, evidence, recall]
---

# Signal-Existence Probe — Results (2026-07-30)

*Packet B item 2. Question: does Recall's demo card type exist as extractable text in real Claude Code transcripts, or is it silent tool-chain pivots? Method: mechanical candidate extraction over 25 real main-session transcripts across 18 projects (synthetic/demo corpora excluded), then LLM classification of a stratified 90-window sample.*

## Corpus reality

- **1,027 transcript files, 475 MB, 101 main sessions.** Full backfill is a genuine budget item — the outside voice's cost warning stands.
- 25 sessions sampled, 2,444 assistant-text blocks, 532 error→retry pivots.

## Headline numbers

| Measure | Result |
|---|---|
| Error pivots verbalized (regex) | **17 / 532 = 3.2%** |
| Silent-pivot windows yielding any card (LLM) | 8 / 35 = 23% — but 12 had **zero prose at all** |
| Net new demo-grade knowledge from silent pivots | **4 items = 11%** |
| Genuine ABANDONED cards in 90 windows | **3 — and only 1 unique event** |
| Overall card yield (any type) | 46 / 90 = **51%** |
| Demo-grade cards | 33 / 90 = **37%** |

## The verdict: the hero card was wrong

**"Failed approach abandoned mid-session" barely exists.** Abandonment is almost never verbalized — the agent hits an error and silently pivots. One unique abandonment event in 90 candidate windows. The demo built on it would have been a lottery ticket, exactly as the outside voice predicted.

**GOTCHA is the real hero card** — 23 of 46 cards (50%), the most abundant, most self-contained, longest-lived type, and **the only type that appears in all three detector buckets**. Decisions collapse to zero outside their own regex; gotchas survive everywhere.

Why gotchas extract better: they state mechanism *and* consequence in one breath, so a card survives losing its surrounding context. Decisions frequently reference alternatives that live in a user turn the card never sees.

## The best card in the corpus (the demo, rewritten)

> "`git -c credential.helper=...` **appends** to the helper list rather than replacing it — Git Credential Manager still runs first and hangs on a GUI prompt that can't appear in a headless session. Reset the list, don't add to it."

Non-obvious, permanently reusable, written in no README, and two turns earlier the same session had only "almost certainly a credential prompt" — so the pair also demos the arc from hypothesis to root cause.

Runners-up: npm remembers unpublished versions (a lower version can't take `latest` afterwards); contamination scanners silently pass benchmark items shorter than the n-gram window (6.8% of a benchmark at n=13); a daemon that never cached pre-existing files made `revert` wipe them to empty instead of restoring.

## Build consequences (all folded into the Recall design doc)

1. **Hero card = GOTCHA** (environment/toolchain discoveries). Decisions are tier 2. Abandonment is a rounding error — keep the type, never headline it.
2. **Regex is a candidate generator, never the final layer.** It put 46 real cards in a 90-item shortlist (useful) but it over-fires on connective tissue ("rather than" = "let me run two commands"), and it **inverts on negation** — "nothing abandoned" and "right not to abandon PRAXIS" both scored as abandonment. A keyword-only extractor would poison the store with confidently false cards. LLM judging is mandatory, not optional.
3. **The highest-value cards contain none of the keywords.** "Root cause: venv on Python 3.15.0a8 — no prebuilt wheels exist yet" has no decision/abandon vocabulary at all. An LLM sweep over error→retry windows recovers these; a bigger regex never will.
4. **Extract on full messages, not 600-char slices** — truncation alone destroyed 2 otherwise-good cards in the sample.
5. **Dedup before extraction, not after.** Identical windows appeared twice and three times in one 90-item sample (resumed sessions and overlapping detectors both cause it).
6. **Half of everything surfaced must be discarded** — human approval or an LLM verification pass is a build requirement.

## Honest caveats

- The strategy-flavored half of the cards came almost entirely from two long planning sessions in one project — do not generalize that half to other users' repos.
- Probe overlap (detectors double-count) and the 600-char window mean absolute counts are soft; the *rates* survived deduplication (≈51% yield, ≈38% demo-grade).
- Hedged causation ("probably", "almost certainly") must be preserved in cards or they become fabrications.

Raw artifacts: `probe.mjs`, `probe-samples.json`, `probe-classify.json` in the session scratchpad.
