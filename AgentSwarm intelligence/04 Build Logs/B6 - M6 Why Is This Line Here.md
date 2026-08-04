---
milestone: M6
date: 2026-08-01
commit: 0b714db
status: shipped
---

# B6 — M6: Why Is This Line Here

There was no M6 in [[P4 - Milestones|the plan]]. The scope came from the three
limits M5 shipped with, plus the one question this product is uniquely able to
answer.

> `git blame` answers **who** and **when**. It cannot answer **why**, because the
> reason was never in the repository — it was in the conversation.

## The feature

Open a changed file in the cockpit (`ctrl+shift+D` → click) and the diff now
arrives with the edits that produced it, and what was being said just before each
one. Every entry is cited to a transcript file and line.

Asked of `app/src/state.js`, it returns the whole argument that shaped that file:

| when | why |
|---|---|
| 17:27 | extracted so the decision logic could be tested rather than assumed |
| 17:43 | must stop inferring from a transcript that is not the pane's own |
| 17:47 | a repainting terminal makes "any byte arrived" the wrong liveness measure |

Three reasons, five edits, `jsonl:1765` · `:1827` · `:1854`. **All checkable.**

That is the product thesis in one screen — the same "answer with receipts" idea
behind [[Recall]], applied to the thing a developer actually asks a repository.

## Three limits from M5, closed

**1 — Attribution was blind to yesterday.** `touched_by` reads *all* history, so
a file changed in a session that ended last week still has an owner and a reason.

The changed-files *list* still uses the live feed — instant, but only sees panes
open now. A full scan per row would make the list crawl, and "why" is asked about
one file at a time. The difference is deliberate, not an oversight.

**2 — Search matched any word instead of every word.** `permission mode` was
returning everything that mentioned either, which buries the answer under near
misses — a search that is technically working and practically broken. Quoting a
phrase keeps it whole.

**3 — Broadcast had no opt-out.** A reviewer running under a read-only policy
should not be handed the same instruction as the pane doing the work, and closing
it is not the right way to arrange that. A muted pane is *visibly* muted: being
surprised that a pane did not receive something is worse than the inconvenience
of muting it.

## A detail worth keeping

Consecutive edits driven by the same explanation collapse into one reason. Five
tool calls carrying out a single decision are **one decision**, and a list that
repeats the same sentence five times reads like noise.

## Verified by operating it

| exercised | result |
|---|---|
| why panel | `why — 3 edits across all history`, reasons deduped |
| citations | `⚙ Write · 7e015ca2.jsonl:1765 · 31/07/2026, 22:57` |
| diff beside it | still rendered, 7 lines, correct classes |
| mute | `1 of 1` → `0 of 1`, pane visibly muted |
| broadcast, all muted | **wrote 0 bytes**, said why |
| console errors | none |

`examples/whycheck.rs` runs the same query against the real transcripts on this
machine, so the result above is reproducible rather than asserted.

21 Rust tests · 25 JS tests.

## Known limits

- The list's attribution is still live-feed only (above — deliberate).
- Attribution matches on file path, so a file renamed since the edit will not
  connect to its history.
- "Why" is the message immediately preceding the edit. Usually the reason;
  sometimes just the sentence before it.

## Where this leaves the project

M1 terminal · M2 understanding · M3 attention · M4 habits · M5 reach · **M6
memory with receipts**.

Six milestones. The unproven thing has not moved and cannot be moved by building:
**four exit tests still need a week of real use.** [[P7 - Baseline Log (fill daily)|The baseline week]] started 2026-08-01 and remains the only thing that
settles them.

See [[B5 - M5 Drive Review Remember]] · [[B4 - M4 It Works For You]] · [[P4 - Milestones]]
