---
tags: [infra, capture]
---

# Session Capture — how conversations save themselves

*Set up 2026-07-30. Before this, the global `Stop → praxis capture` hook was firing but this project had no `.praxis/`, so **two days of work were never captured** — the transcripts existed (5.5 MB in `~/.claude/projects/E--agent-swarm/`) but no memory file, no vault mirror.*

## What runs now, automatically

| Trigger | What fires | What it writes |
|---|---|---|
| **Session ends** | global `Stop` hook → `praxis capture` | session entry in `.praxis/memory.md` · sealed receipt · **vault mirror** |
| **Before compaction** | project `PreCompact` hook | snapshot entry — catches detail right before it's squeezed away |
| **Session starts** | project `SessionStart` hook | tray companion |
| **Traced commits** | `praxis trace on` (not yet enabled) | commit note in the vault + git notes |

**Vault target:** `E:\agent-swarm\AgentSwarm intelligence` → writes into `Praxis/agent-swarm/` (hub, Memory, Sessions/, Commits/, Archive/).

## The duplication fix (worth remembering)

`praxis init` wrote a project-level `Stop` hook while the global settings already had one. Both would have fired on every session end — the exact pathology found in PRAXIS's own repo during the audit (**93 receipt versions for a single session id**, duplicate memory entries 1.07 s apart). The project-level `Stop` was removed; global covers capture, project keeps `PreCompact` + `SessionStart`, which are genuinely new capabilities here.

**Rule going forward:** never let two `Stop` hooks run `capture` for the same project. Check `~/.claude/settings.json` and `.claude/settings.local.json` together.

## Manual controls

- `praxis save` — capture mid-session without waiting for the end (used once already, 2026-07-30)
- `/praxis-save` inside Claude Code — decision-level summary, richer than the automatic template (the automatic one is deterministic: asks, files, commits, closing words — no LLM)
- `praxis status` — memory size, session fill, latest receipt verdict
- `praxis recap` — project brief + last 3 sessions
- `praxis trace on` — start correlating commits to sessions (do this once the repo is git-initialized)

## Known limits (from the audit, worth not rediscovering)

- Memory capture is **deterministic, not LLM** — asks, files, commits, closing words. Decision-level content only comes from `/praxis-save`.
- Session entries are byte-capped (16 KB default); overflow archives to `.praxis/archive/sessions/` and is **never deleted**.
- The vault mirror is one-way. Editing a vault session note does not write back.
- `.praxis/` is gitignored by init.

Related: [[00 Start Here]] · [[R2 - Claude Code Internals|Claude Code Internals]]
