---
name: recall-core-built
description: "recall-core is built and tested at E:\\Recall\\recall-core — the shared organs for Recall M1 and AgentSwarm M2, and the two corpus findings that shaped it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 963a264a-67f8-4eb4-be53-0dd2a8acf13d
  modified: 2026-08-03T09:54:22.495Z
---

`E:\Recall\recall-core` — built 2026-08-02. 19 tests, zero dependencies,
read-only. Modules: `transcript.js` (JSONL → addressable messages),
`locator.js` (content-addressed excerpts), `redact.js` (ported from PRAXIS +
`redactDeep`), `commit.js` (session→commit join). Docs:
`E:\Recall\Recall Vault\03 Plans\P3 - recall-core (built).md`.

**Why it was safe to build while Gate 2 is open:** the Gate 1 audit ruled the
PRAXIS plumbing shared, not rebuilt, and named this package as serving Recall M1
**and** AgentSwarm M2. It is un-wasted whichever project wins the tournament.
It contains no extraction, store, search or answering — those are M1 and stay
blocked.

**The finding that shapes any commit citation:** across 101 real transcripts,
`git log --oneline` output appears **321** times but `[main <sha>] msg` commit
lines only **165**. The common shape is the wrong one — log output means the
session *read* history, not that it *authored* the commit. Citing it attaches an
unrelated, usually older, SHA. `commit.js` returns those as `mentioned` and
never as authorship.

**The bug real data found and inspection did not:** a transcript's `cwd` is
where the SESSION started, not where the COMMAND ran. A session in
`E:\agent-swarm` committed to `/e/faceless-video-pipeline`; one in `E:\space` (since renamed to `E:\gurutva`)
committed to `/e/space/gravity-posterior` (now `/e/gurutva/gravity-posterior`). **3 of 6 sampled commits would have
been cited to the wrong repo.** `effectiveRepo()` resolves `cd`, `Set-Location`
and `git -C`. A second bug (PowerShell's `;` captured into the path) was caught
only by a failing test.

**Process note, learned the hard way again:** the mangled test literals came
from doing a scripted replacement containing Windows paths — the project's own
[[verified-loop]] rule "backslashes never travel through scripted replacements"
applies to test fixtures too. Use Write/Edit, or `String.raw`.

Corpus scale for planning: 30 projects, ~1,068 JSONL files, 707 MB, 38,969
messages in the newest 101 transcripts, 3.1% duplicate replay.

## M1 stage 1 also built (2026-08-02)

`E:\Recall\recall\src\candidates.js` — candidate generation, 8 tests. Surfaces
candidates and refuses to judge them (the probe measured regex at 13% precision
on abandonment and inverting on negation). Two generators: error→retry and
vocabulary. Full messages, dedup first, secrets redacted and transcript fenced
as DATA before any LLM call. Docs: `Recall Vault\03 Plans\P4 - M1 candidate
generation (built).md`.

**Two measurements that change the plan:**

1. **1,782 candidates from 101 transcripts, and 897 of them (50.3%) are
   keyword-free.** A regex-only extractor is blind to half the material — and
   the probe showed the invisible half holds the best cards. LLM judging is now
   measured-mandatory, not argued-mandatory.
2. **A full backfill costs ≈ $2.65** (~690k input, ~392k output tokens at
   Haiku rates). The design hedged "potentially tens of dollars;
   most-recent-3-months-first option" — **that hedge can be dropped.** Index
   everything once.

Abandonment confirmed dead as a hero card: 47 hints in 1,782 candidates (2.6%),
before the judge removes negation inversions.

## M1 stage 2 — the judge (2026-08-02)

`E:\Recall\recall\src\judge.js` + `clients.js` — 28 tests, run live against real
transcripts. Docs: `Recall Vault\03 Plans\P5 - M1 the judge (built).md`.

Enforces three things: transcript text is fenced DATA the model may not obey;
every card must quote its source and the quote is **verified against the
evidence**; a hedge may not be upgraded to a stated fact.

**Backends:** Anthropic API (~$2.65/corpus) when `ANTHROPIC_API_KEY` exists,
else the local `claude` CLI (no key, uses the existing login, ~$0.012 per
candidate). The CLI ships ~24k tokens of its own system prompt per call — one
10-token prompt cost $0.0221 — so batching is structural, not an optimisation.

**Four bugs live runs found that unit tests did not:**
1. `execFile`'s async form silently ignores `input`; use `spawn` + stdin.
2. A multi-line system prompt cannot go through argv on Windows (`claude` is a
   `.cmd`, spawn needs a shell, a shell concatenates without escaping). Put it
   on stdin.
3. **The faithfulness gate searched only the assistant's prose, not the failing
   tool output the judge is deliberately shown** — so a card quoting
   `ModuleNotFoundError` was scored as fabrication. Quote failures fell from 62%
   of attempted cards to 19% after the fix. **Most of what looked like model
   fabrication was our own bug**, and it was found by *printing the refused
   quotes* rather than trusting the count.
4. A batch of 10 truncates mid-JSON at the output limit, losing all ten. Use 5.

**Accept rate is noisy: 17–43% across four runs of the same code.** Never quote a
single run's rate as a property of the system.

Batching has a failure mode fabrication does not: a real quote filed under the
wrong candidate's id. `quoteBelongsTo` distinguishes misattribution (re-file)
from fabrication (reject).

**Not done:** the ≥90% precision gate is unmet because it needs ≥50 cards
verified *by Vaishak* — machine checks cannot substitute. No store, no retrieval,
no `recall "question"` yet.


## M1 is runnable end-to-end (2026-08-02)

**The product is one command.** `E:/Recall/recall` — 42 tests (61 with
recall-core). Docs: `Recall Vault/03 Plans/P6 - M1 store, search, answer (built).md`.

    recall index --limit 40
    recall "why did the build hang?"     # answer + receipts
    recall --grep "keyframes"            # free, instant, no LLM
    recall why <card-id>                 # full receipt chain

Store: `~/.recall/recall.db`, SQLite+FTS5 via Node's built-in `node:sqlite` — no
native module, no install. Currently 62 cards, 40 gotchas (the probe predicted
gotcha would dominate; it does).

Answer layer refuses to: see anything but the retrieved cards; keep a sentence
whose cited card id was not retrieved (measured working — a fabricated "DNS
issue" claim was dropped); silently resolve contradictions; answer when nothing
matched.

**Two bugs found by running it, not reading it:**
1. A pure OR query lets one common word win — "PIL matplotlib executable build"
   returned TikTok API cards because "build" matched. Retrieval now demands all
   terms and relaxes one at a time, OR only as last resort.
2. **A receipt that could not verify itself** — a card quoting tool output built
   its receipt from the empty message body, storing the hash of "" beside a real
   excerpt. Excerpt and hash now always come from one text, with a test walking
   every stored row. This is the exact failure the product exists to prevent.

**Live store needs re-indexing** (`rm ~/.recall/recall.db*`) — part of it was
built before the receipt fix.

**Still blocking:** the >=90% precision gate needs ~50 cards verified BY
VAISHAK. A card can be faithful to its quote and still useless; machine checks
cannot substitute.

Gate 2 remains open with its STOP condition; all of this was built on an explicit
override. The numbers say the engine is buildable and cheap, not that it is
worth building — the baseline week decides that.

See [[recall-memory-design]] for the product design and its gates.
