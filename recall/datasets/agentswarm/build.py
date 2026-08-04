"""Build the AgentSwarm dataset: four sources, one schema, one file to read.

WHY THIS EXISTS
---------------
Four datasets were downloaded because each covers a different corner of one
task. Reading four schemas for the rest of the project is friction that will
quietly stop us using them. This collapses them into a single contract.

THE GOAL (stated first, because everything below is judged against it)
---------------------------------------------------------------------
    Given a CONTEXT and a QUESTION, produce a VERBATIM span from the context,
    or abstain. Never produce text the context does not support.

That is the judge's contract in Recall, and it is also the generation half of
RAG. So one dataset serves both: judge evaluation and RAG evaluation.

THE SCHEMA
----------
    id           str    as-<source>-<split>-<n>
    source       str    squad_v2 | fever | halueval_qa | ragtruth
    task         str    extract | verify | discriminate | ground
    split        str    train | dev | test
    context      str    the grounded passage. THE ONLY permitted evidence.
    question     str    the query
    answer       str    the expected verbatim span, or "" when the row is an
                        abstain case
    answerable   bool   does the context support an answer at all
    span_exact   bool   VERIFIED HERE, not trusted from the source: does
                        `answer` occur character-exact inside `context`?
    span_start   int    offset of that occurrence, or -1
    label        str    answerable | unanswerable | supported | refuted |
                        not_enough_info | faithful | hallucinated
    distractor   str    a plausible-but-unsupported answer, where the source
                        provides one. This is the negative the model must
                        refuse. "" when absent.
    bad_spans    str    JSON list of {start,end,text,kind} — spans of `answer`
                        that are NOT supported by the context. Gold negatives.
                        "[]" when absent.
    meta         str    JSON, source-specific leftovers

CLEANING RULES, and every one of them is enforced not assumed
-------------------------------------------------------------
1. `span_exact` is recomputed against `context`. Sources lie about this.
2. A row whose source claims a span that is not in its context is DROPPED and
   counted. That is a data bug, and silently keeping it teaches paraphrase.
3. Whitespace is normalised (\\r\\n -> \\n, tabs -> space, runs collapsed) BEFORE
   the span check, so normalisation can never invalidate an offset afterwards.
4. Empty context or question -> dropped.
5. Exact duplicates by sha1(context + "\\x00" + question + "\\x00" + answer) ->
   dropped, first occurrence wins.
6. Splits never mix. SQuAD's dev becomes our dev; RAGTruth's test becomes our
   test. No row appears in two splits.

Every drop is counted by reason and written to REPORT.json. A cleaning step
whose losses you cannot see is a cleaning step you cannot trust.

USAGE
-----
    python build.py                     # everything
    python build.py --max-per-source 20000
    python build.py --sources squad_v2 ragtruth
"""

import argparse
import collections
import hashlib
import json
import os
import re

import pyarrow as pa
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.dirname(HERE)          # E:/agent-swarm/recall/datasets
OUT = HERE                           # E:/agent-swarm/recall/datasets/agentswarm

FIELDS = [
    "id", "source", "task", "split", "context", "question", "answer",
    "answerable", "span_exact", "span_start", "label", "distractor",
    "bad_spans", "meta",
]

_WS = re.compile(r"[ \t\u00a0]+")


def norm(s):
    """Normalise whitespace. Runs BEFORE any offset is computed."""
    if s is None:
        return ""
    s = str(s).replace("\r\n", "\n").replace("\r", "\n")
    s = _WS.sub(" ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


class Builder:
    def __init__(self):
        self.rows = []
        self.dropped = collections.Counter()
        self.seen = set()

    def add(self, source, task, split, context, question, answer,
            answerable, label, distractor="", bad_spans=None, meta=None):
        context, question = norm(context), norm(question)
        answer, distractor = norm(answer), norm(distractor)

        if not context:
            self.dropped[f"{source}:empty_context"] += 1
            return
        if not question:
            self.dropped[f"{source}:empty_question"] += 1
            return

        key = hashlib.sha1(
            f"{context}\x00{question}\x00{answer}".encode("utf-8")
        ).hexdigest()
        if key in self.seen:
            self.dropped[f"{source}:duplicate"] += 1
            return
        self.seen.add(key)

        # Rule 1 + 2: verify the span rather than trusting the source.
        span_start = context.find(answer) if answer else -1
        span_exact = span_start >= 0
        if answerable and answer and not span_exact and task == "extract":
            # An extractive row whose answer is not in its passage is broken.
            self.dropped[f"{source}:span_not_in_context"] += 1
            return

        self.rows.append({
            "id": f"as-{source}-{split}-{len(self.rows)}",
            "source": source, "task": task, "split": split,
            "context": context, "question": question, "answer": answer,
            "answerable": bool(answerable),
            "span_exact": bool(span_exact),
            "span_start": int(span_start),
            "label": label,
            "distractor": distractor,
            "bad_spans": json.dumps(bad_spans or [], ensure_ascii=False),
            "meta": json.dumps(meta or {}, ensure_ascii=False),
        })


def read(rel, columns=None):
    path = os.path.join(RAW, rel)
    if not os.path.exists(path):
        return None
    return pq.read_table(path, columns=columns).to_pylist()


# ------------------------------------------------------------------ sources

def load_squad(b, cap):
    """Extractive QA. THE core task shape: verbatim span, or abstain."""
    for src_split, split in (("train", "train"), ("validation", "dev")):
        rows = read(f"squad_v2/{src_split}.parquet")
        if rows is None:
            continue
        for r in rows[:cap]:
            texts = (r.get("answers") or {}).get("text") or []
            answerable = len(texts) > 0
            b.add(
                "squad_v2", "extract", split,
                r["context"], r["question"],
                texts[0] if answerable else "",
                answerable,
                "answerable" if answerable else "unanswerable",
                meta={"title": r.get("title"), "src_id": r.get("id")},
            )


def load_fever(b, cap):
    """Claim verification. NOT ENOUGH INFO is the abstain signal."""
    LABELS = {
        "SUPPORTS": "supported",
        "REFUTES": "refuted",
        "NOT ENOUGH INFO": "not_enough_info",
        "NOT_ENOUGH_INFO": "not_enough_info",
    }
    for src_split, split in (("train", "train"), ("validation", "dev")):
        rows = read(f"fever/{src_split}.parquet")
        if rows is None:
            continue
        for r in rows[:cap]:
            # evidence is list[list[str]]; the last element of each inner list
            # is the sentence text, the earlier ones are page/id metadata.
            sentences, pages = [], []
            for ev in (r.get("evidence") or []):
                if not ev:
                    continue
                sentences.append(ev[-1])
                if len(ev) > 1:
                    pages.append(ev[0])
            context = "\n".join(dict.fromkeys(s for s in sentences if s))
            label = LABELS.get((r.get("label") or "").upper(), "not_enough_info")
            b.add(
                "fever", "verify", split,
                context, r.get("claim"),
                "",                       # verification, not extraction
                label == "supported",
                label,
                meta={"pages": pages[:5], "src_id": r.get("id")},
            )


def load_halueval(b, cap):
    """Paired right / hallucinated answers over identical knowledge.

    The hallucinated answer is the DISTRACTOR: fluent, on-topic, unsupported.
    That is the exact failure mode the faithfulness gate exists to catch.
    """
    rows = read("halueval_qa/data.parquet")
    if rows is None:
        return
    for r in rows[:cap]:
        b.add(
            "halueval_qa", "discriminate", "dev",
            r.get("knowledge"), r.get("question"),
            r.get("right_answer"), True, "answerable",
            distractor=r.get("hallucinated_answer"),
        )


def load_ragtruth(b, cap):
    """Grounded generation with WORD-LEVEL hallucination spans.

    Correction worth recording: an earlier pass concluded these annotations
    were absent, having read the loader's feature list rather than the file.
    They are present — 943 of 2700 test rows carry {start,end,text,label_type}
    offsets into the response. That is the same granularity as our own
    faithfulness gate, which makes this the most on-target source of the four.
    """
    for src_split, split in (("train", "train"), ("test", "test")):
        rows = read(f"ragtruth/{src_split}.parquet")
        if rows is None:
            continue
        for r in rows[:cap]:
            if (r.get("quality") or "good") != "good":
                b.add_dropped = None
                b.dropped["ragtruth:quality_not_good"] += 1
                continue
            raw = r.get("hallucination_labels")
            spans = []
            if raw and raw not in ("[]",):
                try:
                    for s in json.loads(raw):
                        spans.append({
                            "start": s.get("start"),
                            "end": s.get("end"),
                            "text": s.get("text", ""),
                            "kind": s.get("label_type", ""),
                        })
                except (ValueError, TypeError):
                    b.dropped["ragtruth:unparsable_labels"] += 1
            b.add(
                "ragtruth", "ground", split,
                r.get("context"), r.get("query"),
                r.get("output"),
                not spans,                       # clean output == fully grounded
                "hallucinated" if spans else "faithful",
                bad_spans=spans,
                meta={"task_type": r.get("task_type"), "model": r.get("model"),
                      "src_id": r.get("id")},
            )


def load_ragtruth_labeled(b, cap):
    """Response-level faithfulness labels; a held-out check on the above."""
    for name in ("qa", "summarization", "data2txt"):
        rows = read(f"ragtruth_labeled/{name}.parquet")
        if rows is None:
            continue
        for r in rows[:cap]:
            faithful = int(r.get("score") or 0) == 1
            b.add(
                "ragtruth", "ground", "test",
                r.get("source_info") or r.get("prompt"), r.get("prompt"),
                r.get("response"), faithful,
                "faithful" if faithful else "hallucinated",
                meta={"task_type": r.get("task_type"), "labeled": True},
            )


LOADERS = {
    "squad_v2": load_squad,
    "fever": load_fever,
    "halueval_qa": load_halueval,
    "ragtruth": load_ragtruth,
    "ragtruth_labeled": load_ragtruth_labeled,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-per-source", type=int, default=10**9)
    ap.add_argument("--sources", nargs="*", default=list(LOADERS))
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    b = Builder()
    for name in args.sources:
        fn = LOADERS.get(name)
        if not fn:
            print(f"  ?? unknown source {name}")
            continue
        before = len(b.rows)
        fn(b, args.max_per_source)
        print(f"  {name:18s} +{len(b.rows) - before}")

    if not b.rows:
        print("no rows built — is ../  populated? run `python ../fetch.py` first")
        return

    table = pa.Table.from_pylist(b.rows, schema=pa.schema([
        (f, pa.bool_() if f in ("answerable", "span_exact")
         else pa.int64() if f == "span_start" else pa.string())
        for f in FIELDS
    ]))

    by_split = collections.Counter(r["split"] for r in b.rows)
    for split in sorted(by_split):
        mask = [r["split"] == split for r in b.rows]
        sub = table.filter(pa.array(mask))
        pq.write_table(sub, os.path.join(OUT, f"{split}.parquet"),
                       compression="zstd")

    counts = {
        "rows": len(b.rows),
        "by_split": dict(by_split),
        "by_source": dict(collections.Counter(r["source"] for r in b.rows)),
        "by_task": dict(collections.Counter(r["task"] for r in b.rows)),
        "by_label": dict(collections.Counter(r["label"] for r in b.rows)),
        "answerable": sum(r["answerable"] for r in b.rows),
        "span_exact": sum(r["span_exact"] for r in b.rows),
        "with_distractor": sum(1 for r in b.rows if r["distractor"]),
        "with_bad_spans": sum(1 for r in b.rows if r["bad_spans"] != "[]"),
        "dropped": dict(b.dropped),
        "dropped_total": sum(b.dropped.values()),
        "schema": FIELDS,
    }
    with open(os.path.join(OUT, "REPORT.json"), "w", encoding="utf-8") as f:
        json.dump(counts, f, indent=2)

    print(f"\nagentswarm dataset: {counts['rows']} rows  "
          f"({', '.join(f'{k} {v}' for k, v in sorted(by_split.items()))})")
    print(f"dropped: {counts['dropped_total']}")
    for k, v in sorted(b.dropped.items(), key=lambda kv: -kv[1]):
        print(f"    {v:>7}  {k}")
    print(f"\n-> {OUT}")


if __name__ == "__main__":
    main()
