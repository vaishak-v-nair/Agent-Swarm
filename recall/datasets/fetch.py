"""Fetch the datasets that are actually on-target for OUR hallucination problem.

Not a general "hallucination datasets" grab. The measured failure is specific:

    qwen3:4b, given a candidate and asked to COPY an exact span or return null,
    paraphrased the span instead — and dropped candidates entirely.

So the task shape we need data for is: **given a passage, return a verbatim
span, or abstain.** That is extractive QA with unanswerable questions, plus
grounded-generation faithfulness. Datasets that only score final-answer
truthfulness (TruthfulQA and friends) do not teach span-copying and are skipped.

Downloads to E:/agent-swarm/recall/datasets/<name>/, writes a manifest, prints
what each is for. Public datasets only — no token needed.

These four raw sets are then unified into ONE dataset by `agentswarm/build.py`.
Nothing downstream should read them directly; use `agentswarm/load.py`.
"""

import json
import os
import sys
import time
import traceback

OUT = os.path.dirname(os.path.abspath(__file__))

# (key, hf_id, config, splits, why_it_matches_our_problem)
WANTED = [
    (
        "squad_v2",
        "rajpurkar/squad_v2",
        None,
        ["train", "validation"],
        "THE task shape. Answer is a verbatim span from the passage, or the "
        "question is unanswerable and the model must abstain. That is exactly "
        "the judge's contract: copy the quote character-exact, or return null. "
        "~130k train / 12k dev, and half the dev set is deliberately unanswerable, "
        "so it measures the refusal half too.",
    ),
    (
        "ragtruth",
        "wandb/RAGTruth-processed",
        None,
        ["train", "test"],
        "Word-level hallucination annotations on grounded generations. The only "
        "widely available set that labels WHICH SPAN was made up rather than "
        "just scoring the whole response — the same granularity as our "
        "faithfulness gate.",
    ),
    (
        "halueval_qa",
        "pminervini/HaluEval",
        "qa",
        ["data"],
        "Paired right/hallucinated answers over the same knowledge. Useful as a "
        "discrimination eval: can a small model tell the grounded answer from "
        "the plausible-but-unsupported one?",
    ),
    (
        # `fever/fever` still ships a loading script, which datasets>=4 refuses.
        # This mirror carries the same claims with their gold evidence sentences
        # as plain parquet.
        "fever",
        "copenlu/fever_gold_evidence",
        None,
        ["train", "validation"],
        "Claim + evidence-sentence verification (SUPPORTS / REFUTES / NOT ENOUGH "
        "INFO). The NEI class is the one that matters here: it is the training "
        "signal for 'the evidence does not settle this', which is what our "
        "judge does when it returns null.",
    ),
]


def fetch(key, hf_id, config, splits, why):
    from datasets import load_dataset

    dest = os.path.join(OUT, key)
    rows = {}
    t0 = time.time()
    for split in splits:
        ds = load_dataset(hf_id, config, split=split)
        path = os.path.join(dest, f"{split}.parquet")
        os.makedirs(dest, exist_ok=True)
        ds.to_parquet(path)
        rows[split] = ds.num_rows
    size = sum(
        os.path.getsize(os.path.join(dest, f)) for f in os.listdir(dest)
    ) / 1024 ** 2
    return {
        "id": hf_id,
        "config": config,
        "rows": rows,
        "mb": round(size, 1),
        "seconds": round(time.time() - t0, 1),
        "why": why,
        "path": dest.replace("\\", "/"),
    }


def main():
    only = sys.argv[1:] or None
    manifest, failed = {}, {}
    for key, hf_id, config, splits, why in WANTED:
        if only and key not in only:
            continue
        print(f"\n=== {key}  ({hf_id})", flush=True)
        try:
            info = fetch(key, hf_id, config, splits, why)
            manifest[key] = info
            print(f"    ok  {info['rows']}  {info['mb']} MB  {info['seconds']}s", flush=True)
        except Exception as e:
            # A dataset that moved or went gated is normal; record it and carry
            # on rather than losing the ones that did work.
            failed[key] = f"{type(e).__name__}: {e}".split("\n")[0][:300]
            print(f"    FAILED  {failed[key]}", flush=True)

    path = os.path.join(OUT, "manifest.json")
    prev = {}
    if os.path.exists(path):
        try:
            prev = json.load(open(path, encoding="utf-8")).get("datasets", {})
        except Exception:
            pass
    prev.update(manifest)
    json.dump(
        {"datasets": prev, "failed": failed, "note": "public HF datasets; no token used"},
        open(path, "w", encoding="utf-8"),
        indent=2,
    )
    print(f"\nmanifest -> {path}")
    print(f"ok: {len(manifest)}   failed: {len(failed)}")


if __name__ == "__main__":
    main()
