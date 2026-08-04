---
tags: [concept]
---

# The Claim

The claim has been proven wrong twice. Each time it got narrower and more true.

## Version 1 — dead

> "Nobody ingests a builder's work exhaust."

**False.** claude-mem reads Claude Code transcripts. So does an Obsidian plugin. Pieces and screenpipe capture work activity too. See [[R2 - Converger Recon|Converger Recon]].

## Version 2 — dead

> "Nobody refines that exhaust into human answers."

**Also false.** Repowise turns transcripts into decision records with rationale and supersession, and cites its answers. Decispher claims nearly the same design. scribe and Bitloops do versions of it.

## Version 3 — current, and checkable

> **Provenance depth + ingest breadth.** Every card cited to the exact transcript line *and* the commit SHA, built from both transcripts and git. Nobody credible does both.

The whole field cites shallowly:

| Who | What they cite |
|---|---|
| Repowise | file paths only |
| Decispher | `#channel · date`, and discards the raw text |
| Pieces | app name + 20-minute window |
| mem0 | no source field at all |
| claude-mem | session id and file, no line, no commit |

Only **scribe** (54 stars) and **Bitloops** (no disclosed team) go deeper. Neither is credible at scale yet.

**This claim dies if** any competitor ships line + SHA citations from both sources. Then it gets rewritten a fourth time.

## Why this fits you

PRAXIS already proves you can build signed, hash-chained evidence. Deep provenance is the thing you have already done once.

## What the demo actually is

Ask something you cannot remember. Get back a **gotcha** — a hard-won discovery about your tools — with a clickable link to the line where you learned it.

Real example, measured from your own history:

> `git -c credential.helper=...` **appends** to the helper list instead of replacing it. Git Credential Manager still runs first and hangs on a prompt that cannot appear in a headless session. Reset the list, don't add to it.

Nobody writes that down. You learned it once and lost it.

*(The demo used to be built on "a failed approach you abandoned." The probe killed that — see [[R1 - Signal Probe Results|Signal Probe Results]].)*
