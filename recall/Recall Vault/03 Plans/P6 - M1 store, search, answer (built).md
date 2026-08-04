---
tags: [build, m1, store, answer]
built: 2026-08-02
status: runnable end-to-end
---

# M1 stages 3–5 — the store, retrieval, and the answer

**The product is now one command.** `E:\Recall\recall` · 42 tests · 61 across
both packages.

```bash
recall index --limit 40          # build the store from your transcripts
recall "why did the build hang?" # answer, with receipts
recall --grep "keyframes"        # retrieval only: free, instant, no LLM
recall why <card-id>             # the full receipt chain
recall stats / backup
```

Store: `~/.recall/recall.db` — SQLite + FTS5 via Node's built-in `node:sqlite`.
No native module, no install step, no network.

## Proof it works

Asked of a store built from real sessions:

> **`recall "what format works for short social video?"`**
>
> Short social video should follow this pattern: **[6ad44135599f8149]**
> 4:5 portrait · one continuous uncut shot · a persistent headline that never
> moves · live data overlay · 10–21 seconds · zero hard cuts.
>
> RECEIPTS
> **[6ad44135599f8149]** *"They share one grammar: portrait 4:5, one continuous
> always-moving visual on top (raw capture, not polished — a phone filming a
> laptop), a persistent headline…"* — decision · 2026-08-02 · E:\agent-swarm

And the receipt chain no competitor currently reproduces:

> **`recall why 2c4a34c4182d36ba`**
> Sparse keyframes in video sources cause seek failures · gotcha · stated
> quoted: *"Video "aw-v1" has sparse keyframes (max interval: 11.5s). This
> causes seek failures and frame freezing."*
> **from: tool output** · session c7372b58 · message c9e8334e · hash sha256:…

Current store: **62 cards, 40 of them gotchas** — the probe predicted gotcha
would dominate, and it does.

## What the answer layer refuses to do

- **Synthesis sees only the retrieved cards**, never the corpus.
- **Every sentence must cite a card id, and the id must be one that was
  retrieved.** Any sentence failing that is dropped before display — measured
  working: a fabricated "I also recall it was a DNS issue" is removed.
- **Contradictions surface with dates**, never silently resolved.
- **No hits is said plainly** rather than answered anyway.
- `--grep` is free and never calls a model. The moat over `grep` is not speed:
  it is that cards survive transcript rotation and carry verifiable receipts.

## Two bugs found by running it, not by reading it

1. **A pure OR query lets one common word win.** "PIL matplotlib executable
   build" returned cards about TikTok API review times, because "build"
   matched. Retrieval now demands all terms, relaxes one at a time, and only
   falls back to OR when nothing matches.
2. **A receipt that could not verify itself.** A card quoting *tool output* had
   its receipt built from the (empty) message body, storing
   `sha256:e3b0c442…` — the hash of the empty string — beside a real excerpt.
   Excerpt and hash are now always derived from the same text, with a test that
   walks every stored row and verifies it. **This is the exact failure the
   product exists to prevent, and it shipped for one run.**

## What is still not done

- **The ≥90% precision gate is unmet.** It needs ~50 published cards verified
  **by Vaishak**. A card can be perfectly faithful to its quote and still be
  useless; only he can judge that.
- The live store was partly indexed before the receipt fix — **re-index before
  trusting its hashes** (`rm ~/.recall/recall.db*` then `recall index`).
- Indexing is slow through the CLI backend (minutes per session). With
  `ANTHROPIC_API_KEY` set it uses the API instead: ~$2.65 for the whole corpus.
- No daemon (M2), no UI (M3), no MCP server (M4), no vault export.

## Standing caveat

[[P2 - Gates|Gate 2]] is still open with its STOP condition. Everything here was
built on an explicit override. The product runs; whether it earns the build
hours is what the baseline week decides.
