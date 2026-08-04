---
tags: [build, recall-core]
built: 2026-08-02
status: shipped, tested, un-gated
---

# recall-core — the shared organs, built

`E:\Recall\recall-core` · 19 tests passing · no dependencies · reads only.

## Why this exists before Gate 2

[[P2 - Gates|Gate 2]] is open and has a STOP condition, so nothing
Recall-specific may be built yet. This package is the exception the audit
already carved out: the Gate 1 verdict ruled the PRAXIS plumbing be **shared,
not rebuilt**, and named `recall-core` as one package serving **Recall M1 *and*
AgentSwarm M2**. It is therefore un-wasted under every outcome of the
tournament — including the outcome where Recall never gets built.

It contains no extraction, no store, no search, no answering. It reads,
addresses, redacts and joins. Meaning lives one layer up. That keeps the
binding boundary intact: *PRAXIS proves what the AI did; Recall remembers why;
neither becomes the other.*

## What is in it

| Module | Job |
|---|---|
| `transcript.js` | Claude Code JSONL → addressable messages. Sidechains dropped, hook noise stripped, partial tail lines survived, resumed sessions deduped. |
| `locator.js` | Content-addressed excerpts. A receipt carries where it was, what was there, and a sha256 proving it. |
| `redact.js` | Ported from PRAXIS + `redactDeep` for the export path. |
| `commit.js` | The session→commit join — the load-bearing half of the claim. |

## The measurement that shaped `commit.js`

Before writing the parser, 101 real transcripts (15,628 tool results, 1,177 git
commands) were scanned for how SHAs actually appear:

| shape | count | meaning |
|---|---|---|
| `git log --oneline` | **321** | the session **read** history |
| `[main 08516c9] msg` | **165** | the session **authored** that commit |
| generic 40-char | 19 | ambient |
| `rev-parse` | 5 | position query |

The common shape is the wrong one. Citing `git log` output as provenance would
attach an unrelated, usually older commit to a card. So log output never
produces an authorship claim — it is returned as `mentioned` and may never be
rendered as "decided here". There is a test whose only job is to hold that line.

## Two bugs the corpus found that inspection did not

1. **The session's cwd is not the commit's repo.** A session in `E:\agent-swarm`
   ran `cd "/e/faceless-video-pipeline" && git commit`. Another in `E:\space`
   committed to `/e/space/gravity-posterior`. **3 of 6 sampled commits would have
   been cited to the wrong repository.** `effectiveRepo()` now resolves the
   command's real target (`cd`, `Set-Location`, `git -C`).
2. **A shell separator is not part of a path.** `Set-Location E:\PA; git commit`
   captured `E:\PA;`. Found by a failing test, not by reading the regex.

## Measured on the real corpus

```
101 transcripts in 2.5s
  messages parsed          38,353
  duplicate replay          1,208  (3.1% — resumed/compacted)
  messages with prose        5,721
  commits CITABLE              165  ← the SHA half of the claim is buildable
  receipt round-trip         15/15  verified
  messages needing redaction   111  ← redaction is load-bearing, not theatre
```

`npm run probe` reproduces this. It is read-only, calls no LLM, sends nothing.

## What this does NOT do

No cards, no LLM, no store, no search, no answers. Those are M1, and M1 stays
blocked behind Gate 2. The 165 citable commits say the claim is *buildable* —
they do not say it is *worth building*. That is what the baseline week decides.
