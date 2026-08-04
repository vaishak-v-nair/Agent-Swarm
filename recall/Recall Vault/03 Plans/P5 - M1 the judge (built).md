---
tags: [build, m1, judge, evidence]
built: 2026-08-02
status: shipped, tested, run against real transcripts
---

# M1 stage 2 — the judge, built and measured

`E:\Recall\recall\src\judge.js` + `src\clients.js` · 28 tests · run live against
real sessions.

## What it does

Candidates in, typed cards out. Three rules it exists to enforce:

1. **Transcript text is DATA, never instructions.** A transcript is full of
   sentences addressed to an AI. Candidates arrive pre-fenced; the system prompt
   names the fence and refuses to obey anything inside it.
2. **Every card quotes its source, and the quote is checked.** The model returns
   the exact span it read the card from, and `validateCard` verifies that span
   really occurs in the evidence. A paraphrase is a fabricated receipt.
3. **Hedges survive.** A "stated" card whose quote contains *probably / almost
   certainly / seems* is rejected. The probe lists hedge-stripping as a
   fabrication mode.

Card types: `gotcha` (hero), `decision`, `solution`, `failed_approach`.

## Backends, and their measured cost

| backend | needs | cost |
|---|---|---|
| Anthropic API | `ANTHROPIC_API_KEY` | ~$2.65 for the full corpus |
| **`claude` CLI** | nothing — uses the existing login | ~$0.012 per candidate |
| fake | — | tests, free |

**The CLI ships ~24k tokens of Claude Code's own system prompt on every call.**
One 10-token prompt cost $0.0221. That is why batching is not an optimisation
here but the design — and why the API is the default when a key exists.

## Four bugs the live runs found that the tests did not

1. **`execFile` async silently ignores `input`.** The child waited on stdin that
   never arrived and exited with "Input must be provided". Cost a whole sample
   run. Now `spawn` + explicit stdin write.
2. **A multi-line system prompt cannot travel through argv on Windows.**
   `claude` is a `.cmd` shim so spawn needs a shell, and a shell concatenates
   argv without escaping — the prompt was mangled and the reply unparseable.
   The system prompt now goes on stdin; only simple flags go in argv.
3. **The faithfulness gate searched the wrong half of the evidence.** It checked
   only the assistant's prose, not the failing tool output the judge is
   deliberately shown. A card quoting
   `ModuleNotFoundError: No module named 'PIL'` was scored as fabrication.
   **Found by printing the refused quotes instead of trusting the count.**
   Now both halves are checked, and `quoteSource` records which — a quote lifted
   from tool output resolves its receipt to the message that produced the error,
   not to the reply.
4. **A batch of 10 truncates mid-JSON** at the output-token limit, silently
   losing all ten. Batches of 5 are safe with this prompt.

## Measured on real transcripts

Four runs, 30 candidates each (except the first at 12):

| run | batch | cards | accept | quote failures / attempted |
|---|---|---|---|---|
| 1 | 6 | 4 | 33% | 3 / 7 |
| 2 | 10 | 5 | 17% | 8 / 13 |
| 3 | 5 | 6 | 20% | 6 / 12 |
| **4** | 5 | **13** | **43%** | **3 / 16** |

**The gate fix is the visible change:** quote failures fell from 62% of
attempted cards to 19%. Most of what looked like model fabrication was this
codebase checking the wrong text.

**Accept rate is noisy — 17% to 43% across runs of the same code.** Do not
quote a single run's accept rate as a property of the system. The probe's ~51%
yield and this range overlap; more runs are needed before either number means
anything.

## The failure the tests would never have found

Batching creates a failure mode fabrication does not have: **a real quote filed
under the wrong candidate's id.** That is misattribution, fixed by re-filing,
not by rejecting. `quoteBelongsTo` now checks siblings before calling anything
fabrication. Zero occurred in run 4, but the detector stays — it is the
difference between a bug and a lie.

## Cards it produced (a sample worth reading)

> **[gotcha] Excluding PIL from executable builds breaks matplotlib imports**
> Building standalone executables and excluding PIL to save space makes
> matplotlib fail at runtime: its import chain reaches `matplotlib.colors`,
> which needs PIL. The dependency is indirect and non-obvious.
> quote: *"matplotlib needs PIL"*

> **[gotcha] Identical results across runs indicate deterministic failure, not variance**
> quote: *"Runs 2 and 3 are identical — 63.0%/7.5% both times. Identical isn't
> variance; it's a deterministic failure."*

Both are real, transferable, and written in no README. This is the card type the
probe predicted would dominate, and it does.

## What is NOT done

- **The ≥90% precision gate is not met, because it has not been run.** That gate
  requires ≥50 published cards verified *by Vaishak*. Machine checks cannot
  substitute; a card can be faithful to its quote and still be useless.
- No store yet (SQLite + FTS5), no retrieval, no `recall "question"`.
- 1–2 of 6 cards carry a commit; the rest ship transcript-only, as designed.

## Standing caveat

[[P2 - Gates|Gate 2]] is still open and its STOP condition still stands. This
was built on an explicit override. The numbers say the engine works and is
cheap. They do not say it is worth building — the baseline week decides that.
