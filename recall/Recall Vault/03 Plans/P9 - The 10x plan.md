---
tags: [plan, strategy, 10x, flywheel]
written: 2026-08-04
status: proposed — sequenced, costed, exit criteria on every lever
---

# The 10x plan

"10x better" is not a mood. It is six numbers, each with a current measured
value and a target, and a ranked list of levers ordered by leverage per hour.
Everything here is judged against one discipline the project already proved
today: **the BM25 baseline killed the vector index in 75 seconds.** A plan is a
list of fights we intend to arrange, not features we intend to have.

## Where the system actually stands, measured

| axis | today | 10x target | who can move it |
|---|---|---|---|
| judge precision | **unknown** — gate never cleared | ≥90% on 50 human-read cards | **only Vaishak** |
| adoption signal | **0 baseline entries** | 1 week of real `log` entries | **only Vaishak** |
| cost per card | ~$0.04 (API), $0 possible | $0 for the filter pass, pennies for judging | build |
| candidate filtering | none — every candidate hits the LLM | 94%-precision gate drops junk first | build + one GPU |
| answerability model | 0.618 acc (undertrained, CPU-bound) | ≥0.85 on held-out dev | one GPU session |
| retrieval | BM25 0.892 — **defended its title today** | beat 0.892 or keep BM25 | build (card-shaped eval) |

The two rows only Vaishak can move are first on purpose. **Ten times an
unwanted product is still zero.** Every build lever below multiplies through
those two gates.

## The levers, ranked by leverage per hour

### Lever 1 — The flywheel: our exhaust becomes our training data

The single biggest structural upgrade, and the cheapest.

Today the judge reads a candidate, decides, and **throws the decision away**
after storing the card. But every judgment is a labeled training row in
exactly our dataset's schema: context (the candidate), question (the judge
contract), answer (the accepted quote or null), plus — once Vaishak does the
50-card read — a *human* verdict on top.

Wire `recall index` to append every judgment to a fifth source in the dataset:
`source=recall`, `task=extract`, same columns, same `load.py`. The 416k public
rows taught the *shape*; the private rows teach **our distribution** — real
transcripts, real tool output, real developer vocabulary. No other team has
this data, because it is exhaust from our own product. That asymmetry is the
actual moat, and it compounds every time the engine runs.

**Cost:** ~2 hours (the schema already fits). **Exit criterion:** `load("train",
source="recall")` returns real judged rows, and REPORT.json counts them.

### Lever 2 — One GPU session turns the gate from demo to component

The answerability model is 0.618 because it saw 8% of the data with a third of
the encoder frozen on a CPU. Loss was still falling at the last step. One free
Colab/Kaggle GPU session runs the full 142k × 3 epochs unfrozen in under an
hour.

Then the deployment step that makes it matter: **export to ONNX** and run it
inside `recall index` as a pre-filter at threshold 0.9 — where it is already
right 94% of the time when it speaks. Every candidate it kills is an LLM call
never made. The filter is free, local, and millisecond-fast; the expensive
model only sees survivors.

**Exit criteria:** ≥0.85 accuracy on the held-out dev split, else it does not
ship; measured %-of-candidates dropped and $-saved on one real indexing run,
published in the README like every other number.

### Lever 3 — `judgeCapability` becomes a league table

It currently refuses sub-12B local models on a guess inferred from one bad
model. `rag.py answer --n 50 --model <m>` already measures grounding rate and
abstain precision end-to-end. Run it for the realistic candidates — Groq's free
llama-3.3-70b, DeepSeek, qwen3.6 local — and publish the table: **$/card
against faithfulness, per model.** Then `recall config` recommends the cheapest
model that passes, from data.

**Cost:** ~1 hour of wall-clock, mostly waiting. **Exit criterion:** the
hard-coded 12B threshold in `providers.js` is deleted and replaced by a lookup
into measured results.

### Lever 4 — Retrieval: BM25 keeps the title until beaten on OUR data

Dense lost today, 0.748 vs 0.892, and RRF fusion lost too. So: **no vector
index.** The one open question the public data cannot answer is the paraphrase
case — a developer asking "why did auth hang" when the card says "credential
helper blocks headless". That needs a card-shaped eval: take the store's real
cards, write paraphrased queries for them, measure BM25's recall *there*. If
BM25 holds, the question is closed. If it collapses, embeddings get a second
fight on the evidence — fine-tuned on flywheel data (Lever 1), not generic
MiniLM, because generic MiniLM just lost.

**Exit criterion:** a paraphrase-eval number in the README, and a one-line
verdict: BM25 stays / embeddings earn a rematch.

### Lever 5 — Surface it: memory you can see while working

Recall is invisible unless summoned — a CLI and an MCP tool an agent must think
to call. The cockpit already watches every pane. The deferred cross-product
surface is the 10x of *experience*: a quiet panel that says **"3 cards match
what you are doing"** with receipts one click away, powered by the same
`recall_search` the agents use. Nothing writes; it only surfaces. The calm-panel
rule applies — no pulsing, no interruption; the pane is folded until it has
something.

**Entry condition (unchanged from the CEO review):** Recall M2 + cockpit M1.
**Exit criterion:** during one real work session, a surfaced card answers a
question before Vaishak would have asked it — logged as a baseline-week entry,
which feeds the gate that matters.

### Lever 6 — The human gates. No build substitutes.

1. **The 50-card read** — `recall why <id>` on ~50 published cards; each is
   verified-useful, verified-faithful, or trash. ≥90% or the claim fails.
   ~30 minutes of reading. It also produces the first 50 human-labeled flywheel
   rows (Lever 1), so the same half hour advances two levers.
2. **The baseline week** — still zero entries since 2026-08-01.
   `log A glance <what happened>` from any terminal. Four exit tests wait on it.

## Sequencing

**Phase A — this week, CPU only, no permission needed:**
Lever 1 (flywheel plumbing) → Lever 3 (judge league table) → Lever 4
(paraphrase eval). Roughly one day of build, three published numbers.

**Phase B — one GPU session, ~an afternoon:**
Lever 2. Train full, export ONNX, wire behind a flag, measure the drop rate,
flip the flag only if ≥0.85.

**Phase C — the surface, entry-gated:**
Lever 5, only after Recall M2 + cockpit M1, per the CEO review. Not before.

**Throughout:** Lever 6 belongs to Vaishak and blocks nothing except everything.

## What is deliberately NOT in this plan

- **A vector database.** It lost the fight today. Numbers over fashion.
- **Fine-tuning an LLM to judge.** The gate + a capable hosted model is the
  measured-cheap path; training a judge is a moonshot with no failing test
  demanding it.
- **More public datasets.** 416k rows exceed what the models we can train can
  eat. The scarce data is ours (Lever 1), not the Hub's.
- **New surfaces before entry conditions.** The CEO review deferred the
  cross-product pane for a reason that has not changed.

## The standing caveat, still standing

[[P2 - Gates|Gate 2]] remains open with its STOP condition. This plan makes the
engine cheaper, more precise, self-improving and visible. None of that is
evidence anyone needs it — only Lever 6 produces that evidence, and it is the
one lever no amount of building can pull.
