---
name: agentswarm-dataset
description: "The AgentSwarm dataset — four hallucination sets unified into one 416k-row schema at E:/agent-swarm/recall/datasets/agentswarm, with a measured BM25 RAG baseline of recall@1 0.892"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9162a494-02c3-49ab-846a-4c3f8804c34d
  modified: 2026-08-04T09:08:22.567Z
---

**`E:\agent-swarm\recall\datasets\agentswarm\`** — 416,174 rows, built
2026-08-04 from SQuAD v2 + FEVER + HaluEval + RAGTruth. Vaishak wanted ONE
dataset so the rest of the project reads one thing.

**Naming:** first built as "Nimbus" — that was a mistake, Nimbus belongs to a
different project. It is **the AgentSwarm dataset**; row ids are `as-*`.

**Read it only via `load.py`.** A second reader recreates the four-schema
problem it solved.

    from agentswarm.load import load, balanced, contract

## The goal it is built against

> Given a CONTEXT and a QUESTION, return a VERBATIM span, or abstain. Never
> produce text the context does not support.

The judge's contract AND the generation half of RAG — the same sentence twice,
which is why one dataset serves both. It came from a measured failure (qwen3:4b
paraphrased instead of copying, see [[recall-providers-and-mcp]]), so the
dataset is about *copying*, not general truthfulness.

## Schema

`context question answer answerable span_exact span_start label distractor
bad_spans meta` — train 373,069 / dev 37,740 / test 5,365.

- **`span_exact` is recomputed**, never trusted from the source.
- **`bad_spans`** = RAGTruth's word-level hallucination spans. Gold negatives.
- **`distractor`** = HaluEval's fluent-but-unsupported answer, to be refused.

Verified: 92,719/92,719 extractive spans character-exact; zero leakage across
all three split pairs; 720 rows dropped, each counted by reason in
`REPORT.json`.

## RAG is three numbers — `rag.py`

Retrieval / grounding / abstention scored separately, because one end-to-end
score cannot say which half broke.

**Measured BM25 baseline: recall@1 0.892, recall@3 0.966, recall@5 0.978,
MRR 0.930.** Any embedding retriever must beat that. At 0.966 the headroom is
far smaller than intuition suggests — the guard against burning a week on a
vector index that wins nothing.

## ML — `train.py`, and the CPU wall

Task: **answerability** (does this context support an answer at all). It is the
half that fails, and a millisecond CPU classifier can gate the expensive model.

- **TF-IDF + logreg baseline: 50.5% = chance.** Not a failure — SQuAD v2's
  unanswerable questions are *built* to share vocabulary with the passage, so
  bag-of-words has nothing to grab. Anything above 50% is learning something
  real about the question-context relationship.
- **No CUDA on this machine.** Measured **0.27 s/row/epoch** at max_len 160 →
  a 24k x 2 run is ~3.5 hours. Hence `--freeze`, which trains only the upper
  layers (7.2M of 22.7M params).
- 2,000 rows x 1 epoch **collapsed to one class**. Undertrained; kept as the
  evidence for why freezing + more data was needed.
- **transformers 5.x dropped slow->fast tokenizer conversion**, so
  `prajjwal1/bert-tiny` will not load at all. Default is `all-MiniLM-L6-v2`.

## Kaggle

`C:\Users\vaish\.kaggle\kaggle.json`, or set `KAGGLE_USERNAME` / `KAGGLE_KEY`
in `E:\agent-swarm\.env` and no C: file is needed. Nothing here requires it.

Docs: `recall/Recall Vault/03 Plans/P8 - The dataset, and RAG measured.md`.
See [[recall-core-built]], [[recall-providers-and-mcp]],
[[a-schema-description-is-not-the-schema]], [[everything-lives-on-e-drive]].
