---
written: 2026-08-04
purpose: resume point — read this first
---

# NEXT SESSION — start here

The state of everything, and what remains. Updated at the close of the data +
RAG session (2026-08-04).

> **Two projects run in parallel now.** AgentSwarm is the cockpit; **Recall** is
> the memory layer, and it lives in a *separate repo* at `E:\Recall\`. They are
> joined by an MCP server, so an AgentSwarm pane can query Recall. Read
> `E:\Recall\Recall Vault\03 Plans\` for Recall's own history — P1 through P8.

## Where AgentSwarm stands

Feature-complete for launch and **verified by machinery, not claims**:
- 37 Rust + 28 JS tests · `npm run verified` = tests + smoke on the real binary
- `agentswarm --doctor` — seven checks, every failure prints its fix
- `npm run record` — the app films itself driving its own UI (`--demo`)
- Error-dialog bug fixed at the OS level (Job Object; 0 orphaned processes)
- `site/` — self-contained website, ready to deploy as-is to Vercel
- `site/intro.mp4` — **54.2s** film with sound. Superseded cuts kept beside it.
- Fresh MSI at `app/src-tauri/target/release/bundle/msi/`

Launch: `.\agentswarm` from the repo, or `scripts\add-to-path.ps1` once.

## Where Recall stands — `E:\Recall\`

Two packages, **71 tests**, plus a dataset.

| piece | state |
|---|---|
| `recall-core/` | transcript parsing, the session→commit join, locators, redaction. 19 tests. |
| `recall/` | candidates → judge → SQLite FTS5 store → answer with citations. 55 tests. |
| `bin/recall-mcp.js` | **registered and connected**; verified against a live Claude Code session. Read-only on purpose. |
| `src/providers.js` | ollama + Groq/DeepSeek/OpenRouter/Together/LM Studio through one client. |
| `datasets/nimbus/` | **NEW — 416,174 rows, four sources, one schema.** |

**The billing fact, because it is easy to get backwards:** `ANTHROPIC_API_KEY`
bills a *separate* pay-per-token account. The **`claude` CLI is the one that
spends the Max subscription** — measured $0.0221 for a 10-token prompt. Ollama
is free. So the zero-setup path was the expensive one.

## Nimbus — read this before touching data

`E:\Recall\datasets\nimbus\` — one dataset for the rest of the project.
**Read it only through `load.py`.**

```python
from nimbus.load import load, balanced, contract
for r in load("dev", task="extract", limit=500): ...
```

Built against one goal: *given a CONTEXT and a QUESTION, return a VERBATIM span,
or abstain.* That is the judge's contract **and** the generation half of RAG —
the same sentence twice, which is why one dataset serves both.

- 416,174 rows · train 373,069 / dev 37,740 / test 5,365
- squad_v2 142,157 `extract` · fever 243,747 `verify` · halueval 10,000
  `discriminate` · ragtruth 20,270 `ground`
- `span_exact` is **recomputed**, never trusted from the source
- `bad_spans` = word-level hallucination spans · `distractor` = the fluent
  unsupported answer to refuse
- Verified: **92,719/92,719** spans character-exact · **zero** split leakage ·
  720 dropped, each counted by reason in `REPORT.json`

**RAG is three numbers, not one** (`rag.py`) — retrieval, grounding, abstention,
scored separately because one end-to-end score cannot say which half broke.

**Measured BM25 baseline: recall@1 0.892 · recall@3 0.966 · MRR 0.930.**
Any embedding retriever must beat that. At 0.966 the headroom is much smaller
than intuition suggests — this is the guard against a week spent on a vector
index that wins nothing.

Full write-up: `Recall Vault/03 Plans/P8 - Nimbus, and RAG measured.md`.

## Build queue for the next session

1. **Hybrid retrieval for Recall.** Recall's `answer()` is already RAG (FTS5
   retrieve → grounded synthesis → `enforceCitations` drops uncited sentences).
   What is missing is the *semantic* half: a question phrased differently from
   the card misses. Add embeddings, measure with `rag.py`, and **only keep it if
   it beats 0.892 / 0.966.**
2. **Turn `judgeCapability()` into a measurement.** `recall/src/providers.js`
   refuses sub-12B local models on a hard-coded threshold inferred from one bad
   model. `python rag.py answer --n 50 --model <m>` gives a real per-model
   number. An hour, not a project.
3. **THE ≥90% PRECISION GATE — only Vaishak can clear it.** ~50 published cards
   read by a human. Machine checks cannot substitute: a card can be faithful to
   its quote and still useless. This decides whether Recall earns more hours.
4. **THE BASELINE WEEK** — armed 2026-08-01, still **zero entries**. Four exit
   tests need real use; no amount of building substitutes.
   `log A glance <what happened>` from any terminal.
5. **`site/index.html` still plays the raw `agentswarm.mp4`,** not the 54.2s
   film. Decide which the site leads with.
6. **Deploy `site/`** to Vercel; wire the MSI download link.
7. **`/design-shotgun`** — never ran (context died twice). Point it at
   `app/src/style.css` + a fresh `npm run record` frame.
8. Parked with its four gating questions: the **CV agent** idea, in
   `03 Plans/P8 - Ideas (inbox).md`.

## Publish blockers — only Vaishak can decide

1. **No LICENSE file.** The site says "open source"; the repo has no licence.
2. **The vaults are inside the repo.** `AgentSwarm intelligence/` holds private
   session transcripts. Publish from a clean repo, or move the vaults out.
3. **Unsigned MSI.** SmartScreen will warn. The site says so honestly.

## The rules this project runs on (hard-won, do not relearn)

- **Never claim verified without running it.** Five user-found bugs in minutes
  taught this; `npm run verified` enforces it.
- **A schema description is not the schema — open the file.** I declared
  RAGTruth's hallucination spans missing after reading a loader's feature list.
  They were there all along, and it nearly cost us the most on-target source.
  Verify data claims against bytes, and verify a *correction* harder than the
  claim it corrects.
- **Backslashes never travel through scripted replacements.** Seven escaping
  bugs. Write/Edit only; Rust builds paths; fixtures live in files.
- **Print the refused thing, do not trust the count.** A faithfulness bug looked
  like model fabrication until the rejected quotes were printed; failures fell
  from 62% to 19% and most of it was my bug.
- **Regex generates candidates; it is never the final layer.** 50.3% of real
  candidates contain no keyword at all.
- **Drive the UI before shipping** — `app/harness.html` and `--demo`.
- **Never steal focus on a machine someone is using.**
- **A wrong reading is worse than no reading** — degrade by saying so.
- **Calm panel, urgent pilot.** Nothing loops or pulses. **This is a rule about
  the app, not about everything with the app's name on it.** Applied to the
  intro film it produced something inert that had to be rebuilt twice — a film
  someone chose to press play on is a different medium. See
  `intro-video/frame.md`.
- **Video work is saved three places** — project vault, global mirror, and
  `E:\Second Brain\Video Intelligence`, so craft compounds across projects.
- Vocabulary is settled in [[../01 Identity/I1 - What Things Are Called|I1]] —
  one word per concept.

## Where everything lives

| what | where |
|---|---|
| build logs B1–B13 | `04 Build Logs/` |
| plans, P8 CEO review, baseline log P7 | `03 Plans/` |
| vocabulary I1 | `01 Identity/` |
| the intro film | `intro-video/` — BRIEF, STORYBOARD, frame.md, compositions |
| **Recall (separate repo)** | `E:\Recall\` — `recall-core/`, `recall/`, `datasets/` |
| **Recall's vault** | `E:\Recall\Recall Vault\03 Plans\` — P1–P8 |
| **Nimbus** | `E:\Recall\datasets\nimbus\` — `build.py`, `load.py`, `rag.py` |
| video craft, cross-project | `E:\Second Brain\Video Intelligence\` |
| global mirrors | `E:\Second Brain\AgentSwarm Intelligence\`, `…\Recall Intelligence\` |
| machine memory | `C:\Users\vaish\.claude\projects\E--agent-swarm\memory\` |
| Kaggle key (if ever needed) | `C:\Users\vaish\.kaggle\kaggle.json` |
