---
tags: [build, data, dataset, rag, ml, eval]
built: 2026-08-04
status: built and verified — 416,174 rows, RAG baseline measured, training under way
---

# The AgentSwarm dataset, and RAG that reports a number

Four datasets became one. RAG stopped being a word and became three numbers.
Then the machine ran out of GPU, and that became a number too.

> **Naming.** Built first as "Nimbus" — a mistake, that name belongs to a
> different project. It is **the AgentSwarm dataset**. Row ids are `as-*`.

> **Location.** Recall moved from `E:\Recall\` to `E:\agent-swarm\recall\`.
> One project folder. See `DRIVES.md`.

## The problem with four datasets

Downloading SQuAD v2, FEVER, HaluEval and RAGTruth was correct. Keeping them as
four schemas was not — four column layouts, four label vocabularies and four
notions of "answer" is friction that ends in nobody using them.

416,174 rows at `recall/datasets/agentswarm/`. **`load.py` is the only
sanctioned reader**; a second way in would recreate the problem it solved.

## The goal, stated before the data

> Given a CONTEXT and a QUESTION, return a VERBATIM span from the context, or
> abstain. Never produce text the context does not support.

The same sentence twice: [[P5 - M1 the judge (built)|the judge's contract]], and
the generation half of RAG. So one dataset evaluates both.

It came from a measured failure — `qwen3:4b` paraphrased instead of copying, see
[[P7 - AgentSwarm + Recall, and free inference]]. The failure was *copying*, so
the dataset is about copying, not general truthfulness.

## What each source contributes

| source | rows | task | contribution |
|---|---:|---|---|
| squad_v2 | 142,157 | `extract` | The shape itself. **49,438 abstain rows.** |
| fever | 243,747 | `verify` | **72,326 NOT ENOUGH INFO** — the `null` signal. |
| halueval_qa | 10,000 | `discriminate` | Hallucinated answer → `distractor`, to refuse. |
| ragtruth | 20,270 | `ground` | **Word-level hallucination spans** → `bad_spans`. |

## Cleaning, with receipts

Six rules in code, every loss counted. **720 dropped**, itemised in
`REPORT.json`. The one that matters:

> `span_exact` is **recomputed** against the context rather than trusted, and an
> extractive row whose claimed span is not in its passage is dropped. Keeping it
> teaches paraphrase — the exact disease.

Verified after building rather than assumed:

- extractive spans character-exact: **92,719 / 92,719**
- split leakage (train∩dev, train∩test, dev∩test): **0, 0, 0**
- `bad_spans` resolving inside their response: 1,529 / 1,533

## RAG, strictly — three numbers

An end-to-end score cannot say which half is broken, so `rag.py` separates:

1. **Retrieval** — did the right passage come back? `recall@k`, `MRR`
2. **Grounding** — did the answer come only from what came back?
3. **Abstention** — did it refuse when nothing supported it?

**Measured baseline. BM25, plain Python, zero dependencies:**

| metric | value |
|---|---|
| recall@1 | **0.892** |
| recall@3 | 0.966 |
| recall@5 | 0.978 |
| MRR | 0.930 |

The baseline **is** the deliverable. An embedding retriever now has to beat a
measured number, and at recall@3 = 0.966 there is far less headroom than
intuition suggests — the guard against a week spent on a vector index that wins
nothing.

**And then the fight happened (2026-08-04, later the same day):**

| ranker | recall@1 | recall@3 | MRR |
|---|---|---|---|
| **BM25** | **0.892** | **0.966** | **0.930** |
| dense (MiniLM-L6, mean-pooled) | 0.748 | 0.902 | 0.831 |
| hybrid (reciprocal rank fusion) | 0.866 | 0.956 | 0.914 |

**Dense lost by 14 points. Fusing it in made BM25 worse.** No vector index in
Recall's retrieval — one 75-second measurement cancelled a week of default
engineering. Scope caveat: extractive QA is lexically friendly ground for BM25;
the paraphrase case ("question worded differently than the card") is still
unmeasured and needs a card-shaped eval before embeddings get a second fight.

Grounding is scored harshly on purpose: fluent, on-topic and unsupported counts
as a hallucination even when a human would call it basically right.

## The ML, and the wall it hit

`train.py`. Task: **answerability** — does this context support an answer at
all. Chosen because it is the half that fails, and because a classifier
answering it in milliseconds on CPU can sit *in front of* the expensive model,
so you only pay for candidates that survive.

**Baseline: TF-IDF + logistic regression, 50.5% accuracy — chance.**

That is a finding, not a failure. SQuAD v2's unanswerable questions are
*constructed* to share vocabulary with the passage, so bag-of-words has nothing
to grab. It also sets a real bar: anything above 50% is learning something about
the question–context relationship rather than surface statistics.

**The wall: no CUDA on this machine.** A 2,000-row run measured 0.27 s per row
per epoch, implying ~3.5 hours for a 24k × 2 run.

**That figure is contaminated, and so is every wall-clock number in this note.**
A second, larger training run was left going unnoticed and competed for the same
cores throughout — during the calibration run *and* during the 74-minute run
below. Real single-job throughput is faster by an unmeasured margin. Treat all
timings here as **upper bounds**. Accuracy is unaffected: contention changes
speed, not gradients.

The way it hid is the part worth keeping. That run was piped through
`… | tail -60`, which buffers everything until the process exits **and** returns
`tail`'s exit status rather than the job's. So a process killed at step 500 of
1500 reported *"completed, exit code 0"* with an empty log — and I had already
looked at that empty log, guessed the job was dead, and moved on while it
carried on eating half the CPU for ninety minutes.

**Never pipe a long-running job through `tail`.** It suppresses the progress you
need and disguises a death as a success.

Two things came out of hitting it:

1. **`--freeze`.** Freezing the embedding table and the lower encoder layers
   cuts the backward pass to the layers that actually adapt — answerability is
   decided in the upper layers, where question and context tokens attend to each
   other. 7.2M of 22.7M parameters train.
2. **A failed run kept rather than hidden.** 2,000 rows × 1 epoch **collapsed to
   a single class** — abstain precision 0.0, it never predicted "unanswerable"
   at any threshold. Undertrained. It is the evidence for why the frozen
   configuration exists.

Also learned the hard way: **transformers 5.x dropped slow→fast tokenizer
conversion**, so `prajjwal1/bert-tiny` cannot be loaded at all any more. The
default is `all-MiniLM-L6-v2`, which ships a fast tokenizer.

**What is measured**, because accuracy hides the asymmetry:

- `abstain_precision` — when it says "no answer", how often is that right
- `abstain_recall` — of all unanswerable cases, how many were caught
- `answered_when_unanswerable` — **the expensive mistake, named not buried**

Seven thresholds are reported, not one flattering point.

### The result

`all-MiniLM-L6-v2`, 12,000 rows × 2 epochs, embeddings + 2 layers frozen,
**74 minutes of CPU**, on 3,000 held-out dev rows:

| | baseline | trained |
|---|---|---|
| accuracy | 0.505 (chance) | **0.618** |
| abstain precision @0.5 | 0.519 | **0.742** |
| abstain F1 (best, @0.3) | 0.377 | **0.624** |

**The curve matters more than the headline:**

| threshold | accuracy | abstain precision | abstain recall |
|---|---|---|---|
| 0.3 | 0.637 | 0.661 | 0.590 |
| 0.5 | 0.618 | 0.742 | 0.382 |
| 0.7 | 0.579 | 0.824 | 0.220 |
| **0.9** | 0.529 | **0.939** | 0.080 |

At 0.9 it says "this context does not answer the question" and is right **94% of
the time**, catching 8% of unanswerable cases. That is the shape a *gate* wants:
it does not have to catch everything, it has to be trustworthy when it speaks.
Those candidates get dropped before the expensive model is called at all.

**Not good enough to deploy, and the reason is not the method.** Loss was still
falling at the last step — 0.6663 → 0.4676 — so this is *undertrained*, not
converged. It saw 12,000 of 142,157 available rows with a third of the encoder
frozen, because CPU was the ceiling. Published SQuAD 2.0 answerability results
sit near 0.85–0.90 with full fine-tuning of a larger model on a GPU. One GPU
session settles whether this approach gets there. Nothing here says it will.

## Where Recall already is RAG, and where it is not

Recall's `answer()` **is** retrieval-augmented generation today: FTS5 retrieval
→ synthesis over retrieved cards only → `enforceCitations` drops any sentence
that cannot name a retrieved card. Retrieve, augment, generate, with a
faithfulness gate most RAG stacks lack.

What it lacks is the *semantic* half of retrieval — everything is lexical, so a
question phrased differently from the card misses. **That is the gap this now
measures.** Hybrid retrieval starts from 0.892 / 0.966, not from zero.

## The correction that changed a conclusion

An earlier pass wrote that no HuggingFace copy of RAGTruth carries word-level
spans. **Wrong** — `wandb/RAGTruth-processed` carries them, 943 of 2,700 test
rows with `{start,end,text,label_type}` offsets. The error came from reading the
loader's feature list instead of opening the parquet, and it demoted the source
whose granularity *exactly matches our faithfulness gate*.

**A schema description is not the schema. Open the file.**

## Standing caveat

[[P2 - Gates|Gate 2]] is still open with its STOP condition and the baseline
week still has zero entries. This makes the judge *measurable*. It is not
evidence anyone wants the judge.
