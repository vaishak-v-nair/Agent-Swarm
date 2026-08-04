---
written: 2026-08-04
purpose: resume point — read this first
---

# NEXT SESSION — start here

Updated at the close of the reorganisation + ML session (2026-08-04).

> **One folder now.** Recall used to live at `E:\Recall\`. It is now
> `E:\agent-swarm\recall\`, inside this repo. Everything this project produces
> lives on **E:** — see `DRIVES.md` for what is on C:, what moved, and what
> genuinely cannot.

## Where AgentSwarm stands

Feature-complete for launch and **verified by machinery, not claims**:
- 37 Rust + 28 JS tests · `npm run verified` = tests + smoke on the real binary
- `agentswarm --doctor` — seven checks, every failure prints its fix
- `npm run record` — the app films itself driving its own UI (`--demo`)
- `site/` — self-contained website, ready to deploy to Vercel
- `site/intro.mp4` — 54.2s film with sound
- Fresh MSI at `app/src-tauri/target/release/bundle/msi/`

Launch: `.\agentswarm` from the repo, or `scripts\add-to-path.ps1` once.

## Where Recall stands — `E:\agent-swarm\recall\`

| piece | state |
|---|---|
| `recall-core/` | transcript parsing, session→commit join, locators, redaction. **19 tests** |
| `recall/` | candidates → judge → FTS5 store → answer with citations. **56 tests** |
| `recall/bin/recall-mcp.js` | **registered, user-scoped, connected.** Read-only on purpose |
| `recall/src/providers.js` | ollama + Groq/DeepSeek/OpenRouter/Together/LM Studio, one client |
| `.store/` | the SQLite store, **migrated off C:** — 62 cards |
| `datasets/agentswarm/` | **416,174 rows**, one schema, plus RAG + training code |

**The billing fact, easy to get backwards:** `ANTHROPIC_API_KEY` bills a
*separate* pay-per-token account. The **`claude` CLI is what spends the Max
subscription** — measured $0.0221 for a 10-token prompt. Ollama is free. The
zero-setup path was the expensive one.

**Keys go in `E:\agent-swarm\.env`** (gitignored; `.env.example` is tracked and
explains each one). No exporting per shell.

## The dataset — read this before touching data

`E:\agent-swarm\recall\datasets\agentswarm\`. **Read it only via `load.py`.**

> **Naming:** it was briefly called "Nimbus". That was a mistake — Nimbus is a
> different project. It is **the AgentSwarm dataset**; row ids are `as-*`.

```python
from agentswarm.load import load, balanced, contract
```

Built against one goal: *given a CONTEXT and a QUESTION, return a VERBATIM span,
or abstain.* That is the judge's contract **and** the generation half of RAG.

- 416,174 rows · train 373,069 / dev 37,740 / test 5,365
- squad_v2 142,157 `extract` · fever 243,747 `verify` · halueval 10,000
  `discriminate` · ragtruth 20,270 `ground`
- `span_exact` **recomputed**, never trusted · `bad_spans` = word-level
  hallucination spans · `distractor` = the fluent unsupported answer to refuse
- Verified: **92,719/92,719** spans character-exact · **zero** split leakage ·
  720 dropped, each counted by reason

### RAG is three numbers, not one — `rag.py`

Retrieval, grounding, abstention scored separately, because one end-to-end
score cannot say which half broke.

**Measured BM25 baseline: recall@1 0.892 · recall@3 0.966 · MRR 0.930.**
Any embedding retriever must beat that. At 0.966 the headroom is much smaller
than intuition suggests — the guard against a week spent on a vector index that
wins nothing.

### ML — `train.py`, and the wall it hit

Task: **answerability** — does this context support an answer at all. The half
that actually fails, and a millisecond CPU classifier can gate the expensive
model so you only pay for candidates that survive.

- **TF-IDF + logreg baseline: 50.5% — chance.** A finding, not a failure:
  SQuAD v2's unanswerable questions are *built* to share vocabulary with the
  passage. Anything above 50% is learning something real.
- **Trained: 0.618 accuracy**, +11.3 over chance (MiniLM-L6, 12k × 2 epochs,
  2 layers frozen, 74 min CPU, 3k held-out dev).
- **At threshold 0.9: abstain precision 0.939**, recall 0.080. Right 94% of the
  time when it says "no answer" — the shape a **gate** wants. Those candidates
  drop before the expensive model is called.
- **Undertrained, not converged** — loss still falling at the last step
  (0.6663 → 0.4676) on 12k of 142k rows. Published SQuAD 2.0 answerability is
  ~0.85–0.90 with full fine-tuning on GPU. **The limit is compute, not method.**
- **No CUDA.** Hence `--freeze`, training only the upper layers (7.2M of 22.7M).
- **Every wall-clock figure recorded is an UPPER BOUND, not a measurement.** A
  second training run competed for the same cores unnoticed for 90 minutes, so
  "0.27 s/row/epoch" and "74 minutes" are inflated by an unmeasured margin.
  Accuracy is unaffected — contention changes speed, not gradients.
- **Never pipe a long-running job through `tail`.** It buffers all output and
  returns `tail`'s exit code, so a process killed at step 500/1500 reported
  "completed, exit 0" with an empty log.
- A 2k × 1 run **collapsed to one class**. Kept as evidence, not hidden.
- `prajjwal1/bert-tiny` **will not load** — transformers 5.x dropped slow→fast
  tokenizer conversion. Default is `all-MiniLM-L6-v2`.

Full write-up: `recall/Recall Vault/03 Plans/P8 - The dataset, and RAG measured.md`.

## Build queue for the next session

1. **Dense retrieval vs BM25.** Embed contexts with MiniLM, compare against
   0.892 / 0.966. **Only keep it if it wins** — the number exists precisely so
   this can be decided rather than assumed.
2. **Finish the answerability model.** CPU is the constraint; consider a
   Colab/Kaggle GPU session for one proper run, then ship the weights back.
3. **Turn `judgeCapability()` into a measurement.** It refuses sub-12B local
   models on a hard-coded threshold inferred from one bad model.
   `python rag.py answer --n 50 --model <m>` gives a real number per model.
4. **THE ≥90% PRECISION GATE — only Vaishak can clear it.** ~50 published cards
   read by a human. Machine checks cannot substitute: a card can be faithful to
   its quote and still useless.
5. **THE BASELINE WEEK** — armed 2026-08-01, still **zero entries**.
   `log A glance <what happened>` from any terminal.
6. **`site/index.html` still plays the raw `agentswarm.mp4`,** not the film.
7. **Deploy `site/`** to Vercel; wire the MSI download link.
8. Parked with four gating questions: the **CV agent** idea.

## Publish blockers — only Vaishak can decide

1. **No LICENSE file.** The site says "open source"; the repo has no licence.
2. **The vaults are inside the repo** — private transcripts. Publish from a
   clean repo, or move the vaults out. **Recall now lives here too**, which
   makes this bigger, not smaller.
3. **Unsigned MSI.** SmartScreen will warn. The site says so honestly.

## The rules this project runs on (hard-won, do not relearn)

- **Never claim verified without running it.** `npm run verified` enforces it.
- **A schema description is not the schema — open the file.** I declared
  RAGTruth's hallucination spans missing after reading a loader's feature list.
  They were there, and it nearly cost the most on-target source. Verify a
  *correction* harder than the claim it corrects.
- **Backslashes never travel through scripted replacements.** Write/Edit only.
- **Print the refused thing, do not trust the count.** A faithfulness bug looked
  like model fabrication until the rejected quotes were printed; failures fell
  from 62% to 19% and most of it was my bug.
- **Regex generates candidates; it is never the final layer.** 50.3% of real
  candidates contain no keyword at all.
- **Everything lives on E:.** Before writing to a home directory, check whether
  an env var or project path can take it. If a tool hard-codes the path, say so
  and mirror instead of pretending it moved.
- **Drive the UI before shipping** — `app/harness.html` and `--demo`.
- **Never steal focus on a machine someone is using.**
- **A wrong reading is worse than no reading** — degrade by saying so.
- **Calm panel, urgent pilot.** Nothing loops or pulses. **A rule about the app,
  not about everything with the app's name on it** — applied to the intro film
  it produced something inert that had to be rebuilt twice.
- **Video work is saved three places** — project vault, global mirror, and
  `E:\Second Brain\Video Intelligence`.

## Where everything lives

| what | where |
|---|---|
| build logs B1–B13 | `AgentSwarm intelligence/04 Build Logs/` |
| plans, CEO review, baseline log | `AgentSwarm intelligence/03 Plans/` |
| **memory mirror (on E:)** | `AgentSwarm intelligence/06 Memory/` — `scripts\sync-memory.ps1` |
| the intro film | `intro-video/` |
| **Recall** | `recall/` — `recall-core/`, `recall/`, `datasets/`, `.store/` |
| **Recall's vault** | `recall/Recall Vault/03 Plans/` — P1–P8 |
| **the dataset** | `recall/datasets/agentswarm/` — build, load, rag, train |
| **drive layout** | `DRIVES.md` |
| **keys** | `.env` (gitignored) · `.env.example` (tracked) |
| video craft, cross-project | `E:\Second Brain\Video Intelligence\` |
| global mirrors | `E:\Second Brain\AgentSwarm Intelligence\`, `…\Recall Intelligence\` |
| live memory (C:, not movable) | `C:\Users\vaish\.claude\projects\E--agent-swarm\memory\` |
