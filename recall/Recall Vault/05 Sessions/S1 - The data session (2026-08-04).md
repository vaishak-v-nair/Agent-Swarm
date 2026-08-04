---
tags: [session, data, nimbus, rag]
date: 2026-08-04
transcript: C:\Users\vaish\.claude\projects\E--agent-swarm\1aa8a35d-01e9-4a2c-ae81-507b9c694d25.jsonl
---

# S1 — the data session

What was decided and why, in the form the raw transcript cannot give you.

## The arc

1. **Datasets requested**, with an explicit brake: *"don't hope into it because
   it is just for less hallucination."* So: download and evaluate, do not start
   a fine-tuning project. That brake held all session.
2. **Four sets downloaded**, chosen against one *measured* failure rather than
   fame. `qwen3:4b` paraphrased when told to copy a span. So the task shape is
   "verbatim span, or abstain" — and TruthfulQA-style sets, which teach neither
   half, were excluded on purpose.
3. **Nimbus** — Vaishak's call: unify all four into one dataset so the rest of
   the project reads one thing. Framed by him as *define the goal → collect and
   clean → evaluate → deploy*, and the README follows that spine exactly.
4. **RAG, strictly.** Built as three separate measurements.
5. **Session switch** — everything committed, mirrored and written down.

## The decisions worth keeping

**One goal, stated before the data.** *Given a CONTEXT and a QUESTION, return a
VERBATIM span, or abstain.* This is the judge's contract and the generation half
of RAG — the same sentence twice. That equivalence is why one dataset can serve
both, and it is the load-bearing idea in Nimbus.

**`span_exact` is recomputed, never trusted.** Sources misreport this. An
extractive row whose claimed span is not in its passage gets dropped, because
keeping it teaches paraphrase — the exact disease being cured. Result:
92,719/92,719 verified character-exact.

**Every drop is counted by reason.** 720 rows, itemised in `REPORT.json`. A
cleaning step whose losses you cannot see is a cleaning step you cannot trust.

**RAG is three numbers.** Retrieval, grounding, abstention — separately, because
one end-to-end score cannot tell you which half is broken. And the baseline is
**BM25 in plain Python with no dependencies**, deliberately: recall@1 **0.892**,
recall@3 **0.966**, MRR **0.930**. An embedding retriever now has to beat a
measured number. At 0.966 the headroom is far smaller than intuition suggests,
which is precisely the trap that number exists to prevent.

**Grounding is scored harshly.** An answer that is fluent, on-topic and
unsupported counts as a hallucination even when a human would call it basically
right. That is the failure the product exists to prevent, so it cannot be
graded generously.

## The mistake, and what it cost

I told Vaishak — in a README and in chat, framed as a *correction of my own
earlier claim*, which lent it unearned authority — that no HuggingFace copy of
RAGTruth carried word-level hallucination spans.

**It carried them.** 943 of 2,700 test rows, with `{start, end, text,
label_type}` offsets. I had read the `datasets` loader's feature list and a
dataset card instead of opening the parquet. One `pq.read_schema()` would have
shown the columns.

The cost: the source whose granularity **exactly matches our faithfulness gate**
was demoted to "passage/response pairs only" and nearly discarded. It is now the
`bad_spans` column and the most valuable task in Nimbus.

**Standing rule from it:** a schema description is not the schema — open the
file. And verify a correction at least as hard as the claim it corrects, because
corrections inherit credibility they have not earned.

## What was NOT done, deliberately

- **No fine-tuning.** Vaishak's brake was explicit. The data supports it in
  principle; nothing commits to it.
- **No embedding retriever.** Building one before measuring the baseline would
  have been building without a target.
- **Kaggle not used.** The key is Vaishak's to install
  (`C:\Users\vaish\.kaggle\kaggle.json`), and this literature lives on
  HuggingFace anyway — nothing was skipped for lack of it.

## The two things still blocked on Vaishak

1. **The ≥90% precision gate** — ~50 cards read by a human. Machine checks
   cannot substitute; a card can be faithful to its quote and useless.
2. **The baseline week** — armed 2026-08-01, still zero entries.

Neither is unblocked by anything built this session. [[P2 - Gates|Gate 2]]
remains open with its STOP condition. Nimbus makes the judge *measurable*; it is
not evidence anyone wants the judge.
