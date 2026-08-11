"""The rematch — dense retrieval on the REAL workload (P9 Lever 4).

Generic MiniLM lost the public-dataset fight (0.748 vs BM25's 0.892), but that
corpus is keyword-friendly by construction. FTS5 just collapsed to 0.45
recall@1 on paraphrased queries against the real store. Same 20 queries, same
62 cards, dense this time. Whoever wins THIS fight is what Recall's retrieval
should become, because this is the query distribution the product actually
faces.

Run:  python eval/paraphrase_dense.py
"""

import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(os.environ.get("RECALL_HOME", ""), "recall.db") \
    if os.environ.get("RECALL_HOME") \
    else os.path.join(HERE, "..", "..", ".store", "recall.db")


def embed(texts, bs=16, max_len=256):
    import torch
    from transformers import AutoModel, AutoTokenizer
    name = "sentence-transformers/all-MiniLM-L6-v2"
    tok = AutoTokenizer.from_pretrained(name)
    mod = AutoModel.from_pretrained(name)
    mod.eval()
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


def main():
    db = sqlite3.connect(DB)
    cards = db.execute("SELECT id, type, title, body FROM cards").fetchall()
    db.close()

    # A card is retrieved by what it says, so embed what it says.
    docs = [f"{t}. {b}" for _, _, t, b in cards]
    with open(os.path.join(HERE, "paraphrase-queries.json"), encoding="utf-8") as f:
        queries = json.load(f)["queries"]

    D = embed(docs)
    Q = embed([q["query"] for q in queries])
    sims = Q @ D.T

    n = len(queries)
    at1 = at3 = at5 = 0
    mrr = 0.0
    misses = []
    for qi, q in enumerate(queries):
        order = sims[qi].argsort(descending=True).tolist()
        rank = next((p + 1 for p, di in enumerate(order)
                     if cards[di][0].startswith(q["gold"])), 0)
        if rank == 1:
            at1 += 1
        if 1 <= rank <= 3:
            at3 += 1
        if 1 <= rank <= 5:
            at5 += 1
        if rank:
            mrr += 1 / rank
        else:
            misses.append({"gold": q["gold"], "query": q["query"],
                           "got": [cards[order[0]][2]]})

    print(json.dumps({
        "corpus_cards": len(cards), "queries": n,
        "retriever": "dense (MiniLM-L6, mean-pooled)",
        "recall_at_1": round(at1 / n, 3),
        "recall_at_3": round(at3 / n, 3),
        "recall_at_5": round(at5 / n, 3),
        "mrr": round(mrr / n, 3),
        "misses": misses,
    }, indent=2))


if __name__ == "__main__":
    main()
