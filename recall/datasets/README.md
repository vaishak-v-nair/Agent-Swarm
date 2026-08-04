# Datasets — for less hallucination

Downloaded 2026-08-03. Public HuggingFace only; no token used, nothing gated.
Rebuild with `python fetch.py [name…]`. Machine-readable index: `manifest.json`.

**Scope, deliberately small.** These were not picked because they are famous
hallucination benchmarks. They were picked against one measured failure:

> `qwen3:4b`, asked to copy an exact span from a candidate or return null,
> **paraphrased the span instead** and dropped candidates. Zero usable cards.

So the task shape is **"return a verbatim span, or abstain"**. Datasets that
only score final-answer truthfulness (TruthfulQA and similar) do not teach
span-copying and were skipped on purpose.

| dataset | rows | size | what it is for |
|---|---|---|---|
| `squad_v2` | 130k train / 11.9k dev | 22 MB | **The task shape.** Answer is a verbatim span, or the question is unanswerable. Verified: the stored span is character-exact in the context, and **50.1% of dev is unanswerable** — so it measures the *refusal* half too, which is the half our judge gets wrong. |
| `fever` | 228k train / 15.9k val | 70 MB | Claim + gold evidence sentences. **66,380 rows are NOT ENOUGH INFO** — the training signal for "the evidence does not settle this", which is exactly what our judge does when it returns `null`. |
| `halueval_qa` | 10k | 3.5 MB | Paired `right_answer` / `hallucinated_answer` over the same knowledge. A discrimination eval: can a model tell the grounded answer from the plausible-but-unsupported one? |
| `ragtruth_labeled` | 900 × 3 tasks | 2.1 MB | RAG responses with a per-response faithfulness label (`score` 1=faithful, 0=hallucinated; 740/160 on QA). |
| `ragtruth` | 15k train / 2.7k test | 26 MB | Grounded generations **with word-level hallucination spans** — `{start,end,text,label_type}` offsets into the response. The most on-target source here. See the correction below. |

## → Everything above is now unified into `agentswarm/`

Read **`agentswarm/README.md`** and use `agentswarm/load.py`. The four raw sets
stay for rebuilds; nothing downstream should open them directly again.

## A correction, recorded because it changed a conclusion

An earlier version of this file said that **no HuggingFace copy of RAGTruth
carries word-level spans**, and demoted it to "passage/response pairs only".

**That was wrong.** `wandb/RAGTruth-processed` does carry them — 943 of 2,700
test rows have character offsets into the response:

```json
{"start": 110, "end": 138, "text": "She was arrested on March 26",
 "label_type": "Evident Conflict"}
```

Plus `hallucination_labels_processed` with `evident_conflict` (469 rows) and
`baseless_info` (638 rows) flags.

The error came from reading the loader's feature list rather than opening the
parquet. It made the source whose granularity **exactly matches our
faithfulness gate** look like the least useful of the four. The spans are now
the `bad_spans` column in the unified dataset.

Still true: `nimitkalra/RAGTruth` fails to load, and `flowaicom/RAGTruth_test`
(kept as `ragtruth_labeled`) has only per-response labels.

**The lesson, worth more than the data:** a schema description is not the
schema. Open the file.

## Kaggle

**Not downloaded — it needs credentials I cannot create.** Kaggle requires
`~/.kaggle/kaggle.json` from *Account → Create New API Token*. Drop that file in
and `pip install kaggle` makes `kaggle datasets download …` work.

Worth knowing before bothering: for *this* problem Kaggle adds little. The
faithfulness and extractive-QA literature lives on HuggingFace; Kaggle's
strengths are tabular, vision and competition data. Nothing was skipped for lack
of the key.

## The honest caveat on "model training"

These support **evaluation** immediately and **fine-tuning** only in principle.
A fine-tune to make a 4B model copy spans faithfully is a real project — data
prep, LoRA, a training run, and an eval harness — and it competes for the same
hours as everything else under an open Gate 2. Nothing here commits to it.

The cheap thing these enable right now, with no training at all, is a **held-out
faithfulness eval for the judge**: run SQuAD v2 dev through the same
copy-or-abstain contract and get a number for how often a given model
paraphrases instead of copying — per model, before spending anything on a
backfill. That would turn `judgeCapability`'s hard-coded 12B threshold into a
measurement.
