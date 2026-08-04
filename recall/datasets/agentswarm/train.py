"""Train a model on the AgentSwarm dataset. Real training, held-out eval.

THE TASK
--------
**Answerability.** Given a QUESTION and a CONTEXT, predict whether the context
supports an answer at all.

Chosen because it is the half that actually fails. `qwen3:4b` did not fail by
getting answers wrong; it failed by producing an answer when it should have
abstained, and by paraphrasing when it should have copied. A model that can
tell "this context does not answer this question" is the gate in front of the
judge — cheap, local, and it never needs to write a word.

WHY THIS IS WORTH TRAINING RATHER THAN PROMPTING
------------------------------------------------
A prompted 4B model took ~110s per candidate and produced zero usable cards.
A classifier that answers the same yes/no question in milliseconds on CPU, with
a measured precision, is strictly more useful than a slow model that cannot be
trusted — because you can put it *in front of* the expensive model and only pay
for the candidates that survive.

WHAT IS MEASURED
----------------
Not just accuracy — accuracy hides the asymmetry that matters here.

    abstain_precision   when it says "no answer", how often is that right
    abstain_recall      of all unanswerable cases, how many did it catch
    answer_precision    when it says "answerable", how often is that right

The costly error is **answering when you should abstain** — that is the
hallucination. So the threshold is tuned for abstain-side precision, and the
report shows the whole precision/recall curve rather than one flattering point.

USAGE
-----
    python train.py baseline                 # TF-IDF + logistic regression
    python train.py finetune                 # transformer, CPU-friendly
    python train.py finetune --model distilbert-base-uncased --n 40000
"""

import argparse
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from load import load  # noqa: E402

OUT = os.path.join(HERE, "models")


# ------------------------------------------------------------------ data

def dataset(split, n=None, seed=0):
    """Extractive rows only: squad_v2 has clean answerable/unanswerable labels.

    y = 1 means UNANSWERABLE (the positive class is the abstain case), because
    the metric we care about is precision on abstaining.
    """
    rows = list(load(split, task="extract", limit=n, seed=seed))
    X = [(r.question, r.context) for r in rows]
    y = np.array([0 if r.answerable else 1 for r in rows])
    return X, y


def scores(y, pred, name, extra=None):
    tp = int(((pred == 1) & (y == 1)).sum())   # correctly abstained
    fp = int(((pred == 1) & (y == 0)).sum())   # abstained when an answer existed
    tn = int(((pred == 0) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())   # ANSWERED when it should abstain
    out = {
        "model": name,
        "n": int(len(y)),
        "accuracy": round((tp + tn) / len(y), 4),
        "abstain_precision": round(tp / max(tp + fp, 1), 4),
        "abstain_recall": round(tp / max(tp + fn, 1), 4),
        "answer_precision": round(tn / max(tn + fn, 1), 4),
        # The expensive mistake, named explicitly rather than buried in a rate.
        "answered_when_unanswerable": fn,
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }
    out["abstain_f1"] = round(
        2 * out["abstain_precision"] * out["abstain_recall"]
        / max(out["abstain_precision"] + out["abstain_recall"], 1e-9), 4)
    if extra:
        out.update(extra)
    return out


def save(result, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(json.dumps(result, indent=2))
    print(f"-> {path}")


# ------------------------------------------------------------ 1. baseline

def run_baseline(n_train, n_dev):
    """TF-IDF + logistic regression.

    Deliberately naive, and it exists to be beaten. A fine-tune that cannot
    beat bag-of-words has not learned anything about language — it has learned
    that long contexts and short questions correlate with something.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline

    t0 = time.time()
    Xtr, ytr = dataset("train", n_train)
    Xdv, ydv = dataset("dev", n_dev)
    # The question is what varies; joining with a separator lets the model see
    # both sides while keeping their vocabularies distinguishable.
    join = lambda X: [f"{q} [SEP] {c[:2000]}" for q, c in X]  # noqa: E731

    pipe = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_features=200_000,
                        sublinear_tf=True),
        LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced"),
    )
    pipe.fit(join(Xtr), ytr)
    pred = pipe.predict(join(Xdv))
    save(scores(ydv, pred, "tfidf+logreg",
                {"train_rows": len(ytr), "seconds": round(time.time() - t0, 1)}),
         "baseline")


# ------------------------------------------------------------ 2. fine-tune

def run_finetune(model_name, n_train, n_dev, epochs, bs, lr, max_len, freeze=0):
    """Fine-tune a cross-encoder. CPU-friendly by default.

    Question goes FIRST in the pair so that truncating a long context can never
    remove the question — a truncation that eats the question turns the example
    into noise, and the model would learn from noise without complaining.
    """
    import torch
    from torch.utils.data import DataLoader, TensorDataset
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    torch.manual_seed(0)
    torch.set_num_threads(os.cpu_count() or 4)
    t0 = time.time()

    tok = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=2)

    # There is no GPU on this machine. Measured: 0.27 s per row per epoch at
    # max_len 160, so a full 24k x 2 run is ~3.5 hours of CPU.
    #
    # Freezing the embedding table and the lower encoder layers cuts the
    # backward pass to the part that actually adapts. Lower layers of a
    # pretrained encoder carry syntax and general lexical structure, which this
    # task does not need to relearn; answerability is decided in the upper
    # layers where question and context tokens attend to each other.
    if freeze:
        base = getattr(model, model.base_model_prefix)
        for p in base.embeddings.parameters():
            p.requires_grad = False
        layers = base.encoder.layer
        for layer in layers[:freeze]:
            for p in layer.parameters():
                p.requires_grad = False
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total_p = sum(p.numel() for p in model.parameters())
        print(f"  froze embeddings + {freeze}/{len(layers)} layers — "
              f"training {trainable/1e6:.1f}M of {total_p/1e6:.1f}M params",
              flush=True)

    def encode(X, y):
        enc = tok([q for q, _ in X], [c for _, c in X],
                  truncation="only_second", max_length=max_len,
                  padding="max_length", return_tensors="pt")
        return TensorDataset(enc["input_ids"], enc["attention_mask"],
                             torch.tensor(y, dtype=torch.long))

    Xtr, ytr = dataset("train", n_train)
    Xdv, ydv = dataset("dev", n_dev)
    dl = DataLoader(encode(Xtr, ytr), batch_size=bs, shuffle=True)
    dl_dev = DataLoader(encode(Xdv, ydv), batch_size=bs * 2)

    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    total = len(dl) * epochs
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=lr, total_steps=total, pct_start=0.1)

    model.train()
    step = 0
    for ep in range(epochs):
        run = 0.0
        for ids, mask, lab in dl:
            opt.zero_grad()
            loss = model(input_ids=ids, attention_mask=mask, labels=lab).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            run += loss.item()
            step += 1
            if step % 50 == 0:
                print(f"  ep{ep + 1} step {step}/{total} "
                      f"loss {run / 50:.4f}  {time.time() - t0:.0f}s", flush=True)
                run = 0.0

    model.eval()
    probs = []
    with torch.no_grad():
        for ids, mask, _ in dl_dev:
            logits = model(input_ids=ids, attention_mask=mask).logits
            probs.append(torch.softmax(logits, -1)[:, 1].numpy())
    p = np.concatenate(probs)

    # One threshold is a flattering point. Report the curve.
    curve = []
    for t in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9):
        s = scores(ydv, (p >= t).astype(int), f"{model_name}@{t}")
        curve.append({k: s[k] for k in
                      ("model", "accuracy", "abstain_precision",
                       "abstain_recall", "abstain_f1",
                       "answered_when_unanswerable")})

    best = max(curve, key=lambda c: c["abstain_f1"])
    result = scores(ydv, (p >= 0.5).astype(int), model_name, {
        "train_rows": len(ytr), "epochs": epochs, "batch_size": bs, "lr": lr,
        "max_len": max_len, "frozen_layers": freeze,
        "seconds": round(time.time() - t0, 1),
        "threshold_curve": curve,
        "best_threshold_by_abstain_f1": best["model"],
    })
    save(result, "finetune")

    d = os.path.join(OUT, "answerability")
    model.save_pretrained(d)
    tok.save_pretrained(d)
    print(f"weights -> {d}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["baseline", "finetune"])
    # MiniLM-L6: 6 layers / 384 hidden / ~22M params. Fast enough on CPU and it
    # ships a fast tokenizer — transformers 5.x dropped slow->fast conversion,
    # so older checkpoints (bert-tiny) now fail to load at all.
    ap.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2")
    ap.add_argument("--n", type=int, default=30000)
    ap.add_argument("--n-dev", type=int, default=4000)
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--bs", type=int, default=32)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--max-len", type=int, default=256)
    ap.add_argument("--freeze", type=int, default=0,
                    help="freeze embeddings + this many lower encoder layers")
    a = ap.parse_args()
    if a.cmd == "baseline":
        run_baseline(a.n, a.n_dev)
    else:
        run_finetune(a.model, a.n, a.n_dev, a.epochs, a.bs, a.lr, a.max_len,
                     a.freeze)


if __name__ == "__main__":
    main()
