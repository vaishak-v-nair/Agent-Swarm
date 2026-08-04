# The AgentSwarm dataset

**416,174 rows. Four sources, one schema, one file to read.**

Lives at `E:\agent-swarm\recall\datasets\agentswarm\`. Rebuild with
`python build.py`. Read it with `load.py` and nothing else.

```python
from agentswarm.load import load, balanced, contract

for r in load("dev", task="extract", limit=500):
    r.context, r.question, r.answer, r.answerable, r.bad_spans
```

| file | what it does |
|---|---|
| `build.py` | unify the four raw sets, clean, verify, report |
| `load.py` | **the only sanctioned reader** |
| `rag.py` | retrieval / grounding / abstention, scored separately |
| `train.py` | train an answerability classifier, with a held-out eval |
| `REPORT.json` | row counts and every drop, by reason |
| `models/` | trained weights and eval results |

---

## 1. Defining the goal

Everything below is judged against one sentence:

> **Given a CONTEXT and a QUESTION, return a VERBATIM span from the context,
> or abstain. Never produce text the context does not support.**

That is simultaneously **Recall's judge contract** (copy the quote
character-exact, or return `null`) and **the generation half of RAG** (answer
from retrieved passages or say you can't). One goal, so one dataset serves both.

The goal came from a measured failure, not a wishlist. `qwen3:4b`, asked to copy
a span or return null, **paraphrased the span** and dropped candidates — zero
usable cards across four configurations. The failure was *copying*, so the
dataset is about copying. Sets that only score final-answer truthfulness
(TruthfulQA and relatives) teach neither half and are excluded.

## 2. Collecting and cleaning

| source | rows | task | contributes |
|---|---:|---|---|
| `squad_v2` | 142,157 | `extract` | The core shape. **49,438 abstain rows.** |
| `fever` | 243,747 | `verify` | **72,326 NOT ENOUGH INFO** — the `null` signal. |
| `halueval_qa` | 10,000 | `discriminate` | Hallucinated answer → the `distractor` to refuse. |
| `ragtruth` | 20,270 | `ground` | **Word-level hallucination spans** → `bad_spans`. |

### Schema

| field | meaning |
|---|---|
| `context` | the passage. **The only permitted evidence.** |
| `question` | the query |
| `answer` | expected verbatim span, or `""` for abstain rows |
| `answerable` | does the context support an answer at all |
| `span_exact` | **verified here, not trusted from the source** |
| `span_start` | offset of the span, or `-1` |
| `label` | `answerable`/`unanswerable`/`supported`/`refuted`/`not_enough_info`/`faithful`/`hallucinated` |
| `distractor` | plausible-but-unsupported answer the model must refuse |
| `bad_spans` | `[{start,end,text,kind}]` — spans the context does **not** support |

### Cleaning, with receipts

Six rules, each enforced in code, each loss counted. **720 rows dropped**, all
itemised in `REPORT.json`:

```
396  fever:empty_context          173  ragtruth:quality_not_good
 69  fever:duplicate               47  ragtruth:duplicate
 35  squad_v2:duplicate
```

The rule that matters: **`span_exact` is recomputed against the context**, and
an extractive row whose claimed span is not in its passage is dropped. Keeping
it would teach paraphrase — the exact disease being cured.

Verified after building rather than assumed:

| check | result |
|---|---|
| extractive spans character-exact | **92,719 / 92,719** |
| train ∩ dev, train ∩ test, dev ∩ test | **0, 0, 0** |
| `bad_spans` text found in its response | 1,529 / 1,533 |

Splits: `train` 373,069 · `dev` 37,740 · `test` 5,365.

## 3. Evaluating

### RAG is three numbers, not one

One end-to-end score cannot tell you which half is broken, so `rag.py` scores
retrieval, grounding and abstention separately.

```bash
python rag.py retrieve --n 500      # retrieval only, no model needed
python rag.py answer --n 50         # end-to-end, needs a model
```

**Measured baseline — BM25, plain Python, no dependencies:**

| metric | value |
|---|---|
| recall@1 | **0.892** |
| recall@3 | 0.966 |
| recall@5 | 0.978 |
| MRR | 0.930 |

That baseline is the deliverable, not a placeholder. Any embedding retriever
must beat a number that was *measured*. At recall@3 = 0.966 there is much less
headroom than intuition suggests — which is the point of measuring before
building a vector index.

Grounding is scored harshly on purpose: an answer that is fluent, on-topic and
unsupported counts as a hallucination even when a human would call it basically
right.

### Training a model — `train.py`

**The task: answerability.** Given a question and a context, predict whether the
context supports an answer at all.

Chosen because it is the half that actually fails. A classifier answering that
yes/no question in milliseconds on CPU can sit *in front of* the expensive
model, so you only pay for candidates that survive.

```bash
python train.py baseline                         # TF-IDF + logistic regression
python train.py finetune --freeze 2              # transformer, CPU-friendly
```

**What is measured** — accuracy alone hides the asymmetry:

- `abstain_precision` — when it says "no answer", how often is that right
- `abstain_recall` — of all unanswerable cases, how many were caught
- `answered_when_unanswerable` — **the expensive mistake, named not buried**

The threshold curve is reported at seven points rather than one flattering one.

**Baseline result: 50.5% accuracy — chance.** That is a finding, not a failure.
SQuAD v2's unanswerable questions are *constructed* to share vocabulary with the
passage, so bag-of-words has nothing to grab. Anything that beats 50% is
learning something real about the question–context relationship.

### Measured result

`all-MiniLM-L6-v2`, 12,000 rows × 2 epochs, embeddings + 2 layers frozen,
**74 minutes on CPU**, evaluated on 3,000 held-out dev rows:

| | baseline | trained | |
|---|---|---|---|
| accuracy | 0.505 | **0.618** | +11.3 points over chance |
| abstain precision @0.5 | 0.519 | **0.742** | |
| abstain F1 (best, @0.3) | 0.377 | **0.624** | |

**The threshold curve is the useful part, not the headline accuracy:**

| threshold | accuracy | abstain precision | abstain recall |
|---|---|---|---|
| 0.3 | 0.637 | 0.661 | 0.590 |
| 0.5 | 0.618 | 0.742 | 0.382 |
| 0.7 | 0.579 | 0.824 | 0.220 |
| **0.9** | 0.529 | **0.939** | 0.080 |

At 0.9 the model says "this context does not answer the question" and is right
**94% of the time** — while catching only 8% of unanswerable cases. That is
exactly the shape a *gate* wants: it does not need to catch everything, it needs
to be trustworthy when it does speak. Those candidates can be dropped before the
expensive model is ever called.

**It is not good enough to deploy, and the reason is not the method.** Loss was
still falling at the final step (0.4676, from 0.6663), so the run is
*undertrained*, not converged — it saw 12,000 of 142,157 available rows, with a
third of the encoder frozen, because CPU was the ceiling. Published results on
SQuAD 2.0 answerability sit near 0.85–0.90 with full fine-tuning of a larger
model on a GPU. One GPU session would settle whether this approach reaches that;
nothing here says it will.

### The CPU constraint — and why the timings below are upper bounds

This machine has **no CUDA**. That is why `--freeze` exists: freezing the
embedding table and lower encoder layers cuts the backward pass to the layers
that actually adapt, since answerability is decided in the upper layers where
question and context tokens attend to each other.

**Every wall-clock figure recorded here is contaminated and should be read as an
upper bound.** A second, larger training run was left running unnoticed and
competed for the same cores throughout — including during the 2,000-row
calibration that produced the "0.27 s/row/epoch" figure and during the 74-minute
run below. Single-job throughput is faster, by an amount that was never
measured. The *accuracy* numbers are unaffected — contention changes speed, not
gradients — but any capacity planning based on these timings will be
pessimistic.

How it went unnoticed is worth recording: that run was piped through
`… | tail -60`, which buffers all output until the process ends **and** returns
its own exit status. So a job that was killed at step 500 of 1500 reported
"completed, exit code 0" and showed an empty log the entire time it was
running. **Do not pipe a long-running job through `tail`** — the progress you
need is suppressed and a death is disguised as success.

A run of 2,000 rows × 1 epoch **collapsed to a single class** (abstain
precision 0.0). Undertrained, and recorded rather than hidden — it is the
evidence for why the frozen-layer configuration was needed.

Older checkpoints will not load: transformers 5.x dropped slow→fast tokenizer
conversion, so `prajjwal1/bert-tiny` (vocab.txt only) fails outright. The
default is `all-MiniLM-L6-v2`, which ships a fast tokenizer.

## 4. Deploying

The immediate use, needing no further training: **replace the guess in
`recall/src/providers.js`**. `judgeCapability()` refuses sub-12B local models on
a hard-coded threshold inferred from one bad model. `rag.py answer` per model
turns that guess into a measurement.

---

## A correction, recorded because it changed a conclusion

An earlier pass concluded that **no HuggingFace copy of RAGTruth carries
word-level spans** and wrote that into the parent README.

**That was wrong.** `wandb/RAGTruth-processed` carries them — 943 of 2,700 test
rows with `{start, end, text, label_type}` offsets into the response. The error
came from reading the loader's feature list instead of opening the file, and it
made the most on-target source of the four look like a throwaway.

**A schema description is not the schema. Open the file.**
