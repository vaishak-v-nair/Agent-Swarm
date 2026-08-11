"""The judge league table — P9 Lever 3.

`judgeCapability()` refuses sub-12B local models on a guess inferred from one
bad model. This replaces the guess with measurement: every candidate model
runs the same copy-or-abstain contract (`rag.eval_answer`) on the same rows,
and the result is a table of faithfulness against cost.

The pass line, stated rather than implied:

    grounding_rate >= 0.85     when it answers, the answer is verbatim from
                               the retrieved text at least 85% of the time
    hallucinated  <= 2 of n    fluent-but-unsupported answers are the failure
                               this product exists to prevent

A model that fails here produces cards the faithfulness gate will refuse —
paying full inference cost for zero output. That is what the table prevents.

Results append to models/league.json AFTER EVERY MODEL, so a run killed
halfway still keeps its finished rows (the tail lesson, applied).

Run:  python league.py qwen2.5:3b qwen3:4b qwen3.6:latest
      python league.py --n 20 <models...>
"""

import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rag  # noqa: E402

OUT = os.path.join(HERE, "models", "league.json")


def verdict(row):
    ok = (row["grounding_rate"] >= 0.85
          and row["raw"].get("hallucinated", 0) <= max(2, row["n"] // 10))
    return "pass" if ok else "fail"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("models", nargs="+")
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--k", type=int, default=3)
    a = ap.parse_args()

    league = {"generated": None, "n": a.n, "k": a.k,
              "pass_line": "grounding_rate>=0.85 and hallucinated<=max(2,n/10)",
              "models": {}}
    if os.path.exists(OUT):
        try:
            league = json.load(open(OUT, encoding="utf-8"))
        except ValueError:
            pass

    for m in a.models:
        print(f"\n=== {m}", flush=True)
        t0 = time.time()
        try:
            row = rag.eval_answer(n=a.n, k=a.k, model=m)
        except Exception as e:  # noqa: BLE001
            print(f"    FAILED {type(e).__name__}: {str(e)[:200]}", flush=True)
            league["models"][m] = {"error": str(e)[:200]}
        else:
            if row:
                row["seconds_per_call"] = round((time.time() - t0) / max(a.n, 1), 1)
                row["verdict"] = verdict(row)
                league["models"][m] = row
        league["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        json.dump(league, open(OUT, "w", encoding="utf-8"), indent=2)
        print(f"    -> {OUT}", flush=True)

    print("\n| model | grounding | abstain_p | halluc. | s/call | verdict |")
    print("|---|---|---|---|---|---|")
    for name, r in league["models"].items():
        if "error" in r:
            print(f"| {name} | — | — | — | — | error |")
        else:
            print(f"| {name} | {r['grounding_rate']} | {r['abstain_precision']} "
                  f"| {r['raw'].get('hallucinated', 0)}/{r['n']} "
                  f"| {r.get('seconds_per_call', '?')} | **{r['verdict']}** |")


if __name__ == "__main__":
    main()
