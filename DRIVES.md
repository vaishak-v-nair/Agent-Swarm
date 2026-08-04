# What lives on C:, what lives on E:, and what can move

Every project lives on E:. The Windows user profile lives on C:. Some tools
insist on the profile, so this file records what was moved, what was mirrored,
and what genuinely cannot move — measured, not guessed.

## Moved to E: — done

| what | was | now |
|---|---|---|
| **Recall** (the whole project) | `E:\Recall\` | `E:\agent-swarm\recall\` |
| **Recall's store + config** | `C:\Users\vaish\.recall\` | `E:\agent-swarm\recall\.store\` |
| **HuggingFace model cache** | (default `C:\Users\…\.cache`) | `E:\hf_cache\` |
| **All datasets** | — | `E:\agent-swarm\recall\datasets\` |

`RECALL_HOME` is what moves the store, and it is now **read by the code** —
`store.js`, `providers.js` and `recall backup` all honour it, with a test that
fails if they stop. It was in `.env.example` before it was real; that has been
fixed rather than left as a line that quietly does nothing.

The MCP server is registered **with that variable set**, otherwise an agent
would keep reading the old store on C: while everything else read E:.

```bash
claude mcp add -s user recall -e RECALL_HOME=E:/agent-swarm/recall/.store -- node E:/agent-swarm/recall/recall/bin/recall-mcp.js
```

## Mirrored to E: — C: keeps a working copy

| what | size | why it cannot simply move |
|---|---:|---|
| **Claude Code memory** | 42 KB | Claude Code reads a fixed path under the user profile. Not configurable. |

Mirrored into the repo at `AgentSwarm intelligence\06 Memory\`, so it is
version-controlled and survives a C: reinstall:

```bash
.\scripts\sync-memory.ps1
```

`-Restore` copies back the other way onto a fresh machine.

## Cannot move — and one of them you should not want to

| what | size | why |
|---|---:|---|
| **Claude Code session transcripts** | **151 MB** | Claude Code writes them to the user profile. **This is Recall's entire source corpus** — deleting them destroys the thing Recall reads. |
| `C:\Users\vaish\.kaggle\kaggle.json` | 100 B | The `kaggle` library hard-codes the path. |

**On the 151 MB:** that is the honest bulk of this project's C: footprint, and
it is not something I wrote by choice — Claude Code logs every session there.
It is also the raw material: `recall index` reads those `.jsonl` files to build
cards. Moving them breaks indexing; deleting them destroys history that cannot
be regenerated.

If C: space becomes pressing, the sane order is:
1. `recall index` the old sessions **first** so the knowledge is extracted into
   the store on E:,
2. then archive the oldest `.jsonl` files to E: yourself,
3. and keep recent months live.

Do not do (2) before (1). The cards keep transcript locators, and a locator
pointing at a file you deleted is a receipt that cannot be verified — which is
the one thing this product refuses to ship.

**On Kaggle:** the library insists on the profile path, but the env vars are a
documented way around it, and they are already in `.env.example`:

```
KAGGLE_USERNAME=
KAGGLE_KEY=
```

Set those in `E:\agent-swarm\.env` and no file on C: is needed at all.

## Current measured footprint

```
C:\Users\vaish\.claude\projects\E--agent-swarm\   170 MB
    ├── *.jsonl  (session transcripts)            151 MB   cannot move, IS the corpus
    └── memory/  (18 files)                        42 KB   mirrored to E:
C:\Users\vaish\.recall\                           209 KB   MIGRATED -> E: (safe to delete)
C:\Users\vaish\.kaggle\                           100 B    optional, replaceable by env vars
```

Everything else this project produces is on E:.

## The one leftover you can delete by hand

`C:\Users\vaish\.recall\` has been copied to E: and verified reading there
(62 cards intact). It is now dead weight:

```bash
Remove-Item -Recurse -Force "$env:USERPROFILE\.recall"
```

Left in place rather than deleted, because deleting a store is not a decision
to make on someone's behalf.
