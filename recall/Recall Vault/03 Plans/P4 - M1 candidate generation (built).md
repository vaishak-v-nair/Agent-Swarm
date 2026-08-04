---
tags: [build, m1, evidence]
built: 2026-08-02
status: shipped, tested, measured
---

# M1 stage 1 — candidate generation, built and measured

`E:\Recall\recall\src\candidates.js` · 8 tests passing · no LLM call, no writes.
Depends only on [[P3 - recall-core (built)|recall-core]].

## What it is, and what it deliberately is not

It surfaces *candidates* and refuses to judge them. [[R1 - Signal Probe Results|The
probe]] measured a keyword-only extractor at 13% precision on abandonment and
found it **inverts on negation** — "we were right *not* to abandon PRAXIS"
scored as abandonment. So the rule this module obeys is: **regex is a candidate
generator, never the final layer.** Its job is recall; precision is the judge's.

There is a test whose only assertion is that a negated sentence comes back with
no verdict attached.

Two generators, because the probe found they surface different things:

1. **error→retry** — a tool result fails; what the assistant says next. The
   highest-value cards live here and carry no trigger vocabulary at all.
2. **vocabulary** — cheap, catches stated decisions the first misses. Over-fires
   badly. That is expected and acceptable.

Probe findings honoured in code: full messages, never truncated slices (d);
dedup before extraction (e); secrets redacted before any LLM call, and
transcript text fenced as DATA so an instruction inside a transcript cannot
steer the extractor.

## Measured on the real corpus — 101 transcripts, 7.3s

```
messages parsed         38,969
duplicate replay         1,210 (3.1%)
CANDIDATES               1,782   (17.6 per session)
  error-retry            1,141   (64.0%)
  vocabulary               641   (36.0%)

vocabulary hints (hints, NOT verdicts)
  gotcha                   226
  decision                 745
  abandonment               47
  none — keyword-free      897   (50.3%)
```

## The two numbers that change the plan

**1. Half of all candidates are keyword-free (897 of 1,782).** The probe found
this qualitatively on a 90-window sample; it now holds at corpus scale. A
regex-only extractor would be blind to **half** the material — and the probe
showed the invisible half contains the best cards. This is no longer an
argument for LLM judging; it is a measurement.

**2. A full backfill costs about $2.65, not "tens of dollars".**

```
input  ~690k tokens
output ~392k tokens
≈ $2.65 at Haiku-class rates
```

The design hedged: *"backfill gets a budget line (potentially tens of dollars;
most-recent-3-months-first option; chunking strategy)"*. Measured, the whole
six-month history is under three dollars. **The most-recent-3-months hedge can
be dropped** — index everything, once, and stop designing around a cost that
does not exist. Steady-state remains cents/day as designed.

At the probe's measured 51% yield: ~909 cards, ~659 demo-grade.

## Abandonment is confirmed dead as a hero

47 abandonment hints across 1,782 candidates — 2.6%, and that is *before* the
judge discards the negation inversions. The design already demoted it. This
closes the question.

## What is next in M1

1. The judge — Haiku-class extraction over these candidates into typed cards,
   both locators attached ([[P3 - recall-core (built)|recall-core]] supplies them).
2. The verification pass — the probe says ~half of everything surfaced must be
   discarded; the ≥90% precision gate applies to *published* cards after it.
3. SQLite + FTS5 store, then retrieve-then-synthesize with receipts.

## Standing caveat

[[P2 - Gates|Gate 2]] is still open and its STOP condition still stands. This
was built on an explicit override, and the baseline week has zero entries. These
numbers say the engine is **buildable and cheap**. They say nothing about
whether it is **worth building** — that is what the baseline week decides.
