"""RAG over the AgentSwarm dataset: retrieve, then answer only from what was
retrieved.

STRICTLY RAG means three things must each be measurable on their own, because
a single end-to-end score cannot tell you which half is broken:

    1. RETRIEVAL   did the right passage come back at all?      -> recall@k
    2. GROUNDING   did the answer come only from what came back? -> faithfulness
    3. ABSTENTION  did it refuse when nothing supported it?      -> refusal rate

The dataset is built for exactly this: every row is already
(context, question, grounded-answer-or-abstain), which is the RAG triple. So
the same file evaluates the retriever and the generator.

    python rag.py index --n 2000        # build a corpus from dataset contexts
    python rag.py retrieve --n 200      # measure recall@k, no model needed
    python rag.py answer --n 50         # end-to-end, needs a model

The retriever here is BM25 in plain Python with no dependencies. That is
deliberate: it is the honest baseline. Any embedding retriever added later has
to beat a number that was actually measured, not a number that was assumed.
"""

import argparse
import collections
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from load import load, CONTRACT  # noqa: E402

TOKEN = re.compile(r"[a-z0-9]+")
STOP = set("""a an and are as at be by for from has have how in is it its of on
or that the this to was were what when where which who why with""".split())


def toks(s):
    return [t for t in TOKEN.findall(s.lower()) if t not in STOP and len(t) > 1]


class BM25:
    """Okapi BM25. ~60 lines, no dependency, and it is a genuinely strong
    baseline for keyword-shaped queries — which developer questions are."""

    def __init__(self, docs, k1=1.5, b=0.75):
        self.docs = docs
        self.k1, self.b = k1, b
        self.tf = []
        self.df = collections.Counter()
        for d in docs:
            c = collections.Counter(toks(d))
            self.tf.append(c)
            self.df.update(c.keys())
        self.len = [sum(c.values()) for c in self.tf]
        self.avg = (sum(self.len) / len(self.len)) if self.len else 0.0
        n = len(docs)
        self.idf = {
            t: math.log(1 + (n - f + 0.5) / (f + 0.5))
            for t, f in self.df.items()
        }
        self.inv = collections.defaultdict(list)
        for i, c in enumerate(self.tf):
            for t in c:
                self.inv[t].append(i)

    def search(self, query, k=5):
        q = toks(query)
        scores = collections.defaultdict(float)
        for t in q:
            idf = self.idf.get(t)
            if idf is None:
                continue
            for i in self.inv[t]:
                f = self.tf[i][t]
                denom = f + self.k1 * (1 - self.b + self.b * self.len[i] / (self.avg or 1))
                scores[i] += idf * f * (self.k1 + 1) / denom
        return sorted(scores.items(), key=lambda kv: -kv[1])[:k]


def corpus(n, split="dev", task="extract", seed=0):
    """Every distinct context becomes a retrievable document. The gold answer
    for a question is the document its own context became."""
    rows = list(load(split, task=task, limit=n, seed=seed))
    docs, index = [], {}
    for r in rows:
        if r.context not in index:
            index[r.context] = len(docs)
            docs.append(r.context)
    return rows, docs, index


# ------------------------------------------------------------------ 1. retrieval

def eval_retrieval(n=200, ks=(1, 3, 5, 10)):
    rows, docs, index = corpus(n)
    bm = BM25(docs)
    hits = collections.Counter()
    ranks = []
    for r in rows:
        gold = index[r.context]
        got = [i for i, _ in bm.search(r.question, k=max(ks))]
        rank = got.index(gold) + 1 if gold in got else None
        ranks.append(rank)
        for k in ks:
            if rank and rank <= k:
                hits[k] += 1
    mrr = sum(1 / r for r in ranks if r) / len(ranks)
    out = {
        "questions": len(rows), "documents": len(docs),
        "recall_at": {k: round(hits[k] / len(rows), 4) for k in ks},
        "mrr": round(mrr, 4),
        "retriever": "bm25-baseline",
    }
    print(json.dumps(out, indent=2))
    return out


# ------------------------------------------------------------------ 2+3. answering

def eval_answer(n=50, k=3, model=None):
    """End-to-end. Retrieve k passages, answer ONLY from them, and score the
    three things separately.

    The scoring is deliberately harsh about one case: an answer that is
    fluent, on-topic, and unsupported counts as a hallucination even if a
    human would call it 'basically right'. That is the failure this whole
    project exists to prevent.
    """
    try:
        from openai import OpenAI
    except ImportError:
        print("needs `pip install openai` (works against ollama too)")
        return
    base = os.environ.get("OPENAI_BASE_URL", "http://localhost:11434/v1")
    key = os.environ.get("OPENAI_API_KEY", "ollama")
    model = model or os.environ.get("AS_MODEL", "qwen3:4b")
    client = OpenAI(base_url=base, api_key=key)

    rows, docs, index = corpus(n)
    bm = BM25(docs)
    stat = collections.Counter()
    for r in rows:
        got = [docs[i] for i, _ in bm.search(r.question, k=k)]
        retrieved = "\n\n---\n\n".join(got)
        stat["retrieval_hit"] += int(r.context in got)
        prompt = f"{CONTRACT}\nCONTEXT:\n{retrieved}\n\nQUESTION:\n{r.question}\n"
        try:
            reply = client.chat.completions.create(
                model=model, temperature=0,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            ).choices[0].message.content
            ans = (json.loads(reply) or {}).get("answer")
        except Exception as e:                      # noqa: BLE001
            stat["error"] += 1
            print(f"  ! {type(e).__name__}: {str(e)[:90]}")
            continue

        if ans is None:
            stat["abstained"] += 1
            stat["correct_abstain" if not r.answerable else "wrong_abstain"] += 1
        else:
            stat["answered"] += 1
            # Grounding: the answer must appear verbatim in what was retrieved.
            stat["grounded" if ans in retrieved else "hallucinated"] += 1
            if not r.answerable:
                stat["answered_unanswerable"] += 1

    total = len(rows)
    out = {
        "model": model, "n": total, "k": k,
        "retrieval_hit_rate": round(stat["retrieval_hit"] / total, 3),
        "abstain_precision": round(
            stat["correct_abstain"] / max(stat["abstained"], 1), 3),
        "grounding_rate": round(stat["grounded"] / max(stat["answered"], 1), 3),
        "hallucinated": stat["hallucinated"],
        "answered_when_unanswerable": stat["answered_unanswerable"],
        "raw": dict(stat),
    }
    print(json.dumps(out, indent=2))
    return out


# ------------------------------------------------------ dense vs BM25 vs hybrid

EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def embed(texts, model_name=EMB_MODEL, bs=16, max_len=256):
    """Mean-pooled MiniLM embeddings, L2-normalised.

    This is the sentence-transformers recipe without the sentence-transformers
    dependency — it is not installed here, and one pooling function is not a
    reason to add a package.
    """
    import torch
    from transformers import AutoModel, AutoTokenizer

    tok = AutoTokenizer.from_pretrained(model_name)
    mod = AutoModel.from_pretrained(model_name)
    mod.eval()
    torch.set_num_threads(os.cpu_count() or 4)
    out = []
    with torch.no_grad():
        for i in range(0, len(texts), bs):
            enc = tok(texts[i:i + bs], padding=True, truncation=True,
                      max_length=max_len, return_tensors="pt")
            h = mod(**enc).last_hidden_state
            m = enc["attention_mask"].unsqueeze(-1).float()
            v = (h * m).sum(1) / m.sum(1).clamp(min=1e-9)
            out.append(torch.nn.functional.normalize(v, dim=-1))
    return torch.cat(out)


def eval_dense(n=500, ks=(1, 3, 5, 10), pool=50):
    """The three-way judgment: BM25 vs dense vs hybrid (reciprocal rank fusion).

    This exists because the BM25 baseline (recall@1 0.892) was measured first,
    precisely so that embeddings would have to BEAT a number to earn a place in
    the store. Whatever wins here is what Recall's retrieval should become; if
    dense loses, that is a result too, and it gets recorded rather than retried
    until it flatters.
    """
    import time as _t

    rows, docs, index = corpus(n)
    bm = BM25(docs)

    t0 = _t.time()
    D = embed(docs)
    Q = embed([r.question for r in rows])
    embed_seconds = round(_t.time() - t0, 1)

    sims = Q @ D.T   # cosine, since both sides are L2-normalised

    def rank_of(gold, ordered):
        try:
            return ordered.index(gold) + 1
        except ValueError:
            return None

    ranks = {"bm25": [], "dense": [], "hybrid": []}
    for qi, r in enumerate(rows):
        gold = index[r.context]
        bm_top = [i for i, _ in bm.search(r.question, k=pool)]
        de_top = sims[qi].topk(min(pool, len(docs))).indices.tolist()
        # Reciprocal rank fusion, k=60 — the standard, parameter-light way to
        # combine rankers that score on incomparable scales.
        fused = {}
        for lst in (bm_top, de_top):
            for pos, doc in enumerate(lst):
                fused[doc] = fused.get(doc, 0.0) + 1.0 / (60 + pos + 1)
        hy_top = [d for d, _ in sorted(fused.items(), key=lambda kv: -kv[1])]
        ranks["bm25"].append(rank_of(gold, bm_top))
        ranks["dense"].append(rank_of(gold, de_top))
        ranks["hybrid"].append(rank_of(gold, hy_top))

    out = {"questions": len(rows), "documents": len(docs),
           "embed_seconds": embed_seconds, "model": EMB_MODEL, "rankers": {}}
    for name, rs in ranks.items():
        out["rankers"][name] = {
            "recall_at": {k: round(sum(1 for x in rs if x and x <= k) / len(rs), 4)
                          for k in ks},
            "mrr": round(sum(1 / x for x in rs if x) / len(rs), 4),
        }
    print(json.dumps(out, indent=2))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["index", "retrieve", "answer", "dense"])
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--k", type=int, default=3)
    ap.add_argument("--model")
    a = ap.parse_args()
    if a.cmd == "index":
        rows, docs, _ = corpus(a.n)
        print(f"{len(rows)} questions over {len(docs)} documents")
    elif a.cmd == "retrieve":
        eval_retrieval(a.n)
    elif a.cmd == "dense":
        eval_dense(a.n)
    else:
        eval_answer(a.n, a.k, a.model)


if __name__ == "__main__":
    main()
