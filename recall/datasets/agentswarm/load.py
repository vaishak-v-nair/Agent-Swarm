"""The one way to read the AgentSwarm dataset. Import this; never open the
parquet by hand.

    from agentswarm.load import load, contract

    for r in load("dev", task="extract", limit=500):
        r.context, r.question, r.answer, r.answerable, r.bad_spans

Why a loader and not "just read the parquet": the whole point of this dataset
was to stop four schemas leaking into the project. A second way to read it
would recreate the problem it solved.
"""

import json
import os
import random

import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))

SPLITS = ("train", "dev", "test")
TASKS = ("extract", "verify", "discriminate", "ground")


class Row(dict):
    """dict with attribute access, so r.context reads like the schema doc."""

    __getattr__ = dict.__getitem__


def load(split="dev", task=None, source=None, label=None, limit=None,
         seed=None, answerable=None):
    """Yield dataset rows. Filters compose; `seed` shuffles deterministically."""
    if split not in SPLITS:
        raise ValueError(f"split must be one of {SPLITS}, got {split!r}")
    path = os.path.join(HERE, f"{split}.parquet")
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} — run `python build.py` first")

    rows = pq.read_table(path).to_pylist()
    if task:
        rows = [r for r in rows if r["task"] == task]
    if source:
        rows = [r for r in rows if r["source"] == source]
    if label:
        labels = {label} if isinstance(label, str) else set(label)
        rows = [r for r in rows if r["label"] in labels]
    if answerable is not None:
        rows = [r for r in rows if r["answerable"] == answerable]
    if seed is not None:
        random.Random(seed).shuffle(rows)
    if limit:
        rows = rows[:limit]

    for r in rows:
        r["bad_spans"] = json.loads(r["bad_spans"])
        r["meta"] = json.loads(r["meta"])
        yield Row(r)


def balanced(split="dev", n=200, seed=0, task="extract"):
    """Half answerable, half not. The refusal half is the half models fail,
    and a natural sample under-weights it."""
    yes = list(load(split, task=task, answerable=True, limit=n // 2, seed=seed))
    no = list(load(split, task=task, answerable=False, limit=n - len(yes), seed=seed))
    out = yes + no
    random.Random(seed).shuffle(out)
    return out


def report():
    with open(os.path.join(HERE, "REPORT.json"), encoding="utf-8") as f:
        return json.load(f)


CONTRACT = """\
You are given a CONTEXT and a QUESTION.

Return JSON: {"answer": "<verbatim span copied from CONTEXT>"} if and only if
the CONTEXT contains the answer, otherwise {"answer": null}.

Rules:
- The span must be COPIED character-for-character from CONTEXT. Do not
  rephrase, summarise, correct, complete, or tidy it.
- If the CONTEXT does not answer the QUESTION, return null. Returning a
  plausible answer that CONTEXT does not support is the worst outcome —
  worse than returning null when an answer existed.
"""


def contract(row):
    """The exact prompt shape the judge uses, so an eval score transfers."""
    return f"{CONTRACT}\nCONTEXT:\n{row.context}\n\nQUESTION:\n{row.question}\n"


if __name__ == "__main__":
    r = report()
    print(f"agentswarm dataset  {r['rows']} rows")
    for k in ("by_split", "by_source", "by_task", "by_label"):
        print(f"  {k:10s} {r[k]}")
    print(f"  dropped    {r['dropped_total']} ({r['dropped']})")
    ex = next(load("dev", task="extract", answerable=False))
    print(f"\nsample abstain row: {ex.question!r} -> answer={ex.answer!r}")
