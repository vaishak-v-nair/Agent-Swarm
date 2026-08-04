---
name: everything-lives-on-e-drive
description: "Vaishak's projects all live on E:; C: is only the Windows profile. Recall moved inside E:/agent-swarm, and RECALL_HOME now moves its store off C: too"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9162a494-02c3-49ab-846a-4c3f8804c34d
  modified: 2026-08-04T09:08:39.085Z
---

**Every project lives on E:. C: is the Windows profile and should stay small.**
Vaishak raised this directly: writing to both drives eats C: space for nothing.

**Why:** it is his machine's layout, not a preference to re-litigate. Anything I
*choose* the location of belongs on E:, inside the project it serves.

## The layout, as of 2026-08-04

- **Recall now lives INSIDE AgentSwarm** — `E:\agent-swarm\recall\`, moved from
  `E:\Recall\`. Vaishak: one project folder, no confusion. Its standalone git
  history is parked at `recall/_git-standalone-history`; `agent-swarm` tracks
  the files now.
- `RECALL_HOME` moves Recall's SQLite store off C:. **I invented that variable
  in a `.env` before it existed** — then implemented it for real in
  `store.js`, `providers.js` and `recall backup`, with a test. Store migrated
  to `E:\agent-swarm\recall\.store` (62 cards intact).
- **The MCP server must be registered WITH that env var**, or agents keep
  reading the old store on C: while everything else reads E:.
  `claude mcp add -s user recall -e RECALL_HOME=E:/agent-swarm/recall/.store -- node …`
- HuggingFace cache is on `E:\hf_cache`.
- `E:\agent-swarm\.env` (gitignored) + `.env.example` (tracked) hold keys, so
  they are pasted once rather than exported per shell.

## What genuinely cannot move

- **Claude Code's session transcripts, 151 MB** under the user profile. Not
  configurable — and **they are Recall's entire source corpus**, so deleting
  them destroys what Recall reads. If C: gets tight: `recall index` first, then
  archive old `.jsonl` to E:. Never the reverse; a card's transcript locator
  pointing at a deleted file is an unverifiable receipt.
- **Claude Code's memory directory** (42 KB) — fixed path. Mirrored into the
  repo by `scripts\sync-memory.ps1`, so it is version-controlled and survives a
  C: reinstall. `-Restore` copies back.
- `~/.kaggle/kaggle.json` — hard-coded by the library, but `KAGGLE_USERNAME` /
  `KAGGLE_KEY` in `.env` replace it entirely.

**How to apply:** before writing anything to a home directory, ask whether an
env var or a project path can take it, and if the tool hard-codes the path, say
so plainly and mirror instead of pretending it moved. Full accounting with
measured sizes: `E:\agent-swarm\DRIVES.md`.

See [[agentswarm-dataset]], [[recall-providers-and-mcp]].
