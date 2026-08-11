---
name: faceless-tool-state
description: "Faceless video tool — where session 1 ended, what works, the owner-only blockers, and the traps session 2 must not relearn"
metadata: 
  node_type: memory
  type: project
  originSessionId: a699af86-c975-44a3-add2-02c53111b0ff
  modified: 2026-08-09T15:42:34.547Z
---

As of 2026-08-09, the faceless-video tool is at commit `0778c71`, **1144
tests green**, everything merged to `main`. Code: `E:\faceless-video-pipeline`.
Data: `E:\content-workflow`. Full handoff: `E:\agent-swarm\00 Start Here\NEXT
SESSION.md` (note: that vault note lives in the AgentSwarm folder only
because session 1's cwd was wrong — the convention predates the mistake).

**Works end to end:** the tool (`python -m vidpipe.cli tool` from the DATA
dir) — dashboard, in-process worker, five review actions, Connect YouTube,
publish, JSON API; model cascade with live health; voice-led timing;
one-setting scripts with a 7-video exclusion history; keyword+contradiction
footage ranking; script-mood-led music with a local folder source;
self-critique via Gemini (File API for >14MB). The owner built their own
Tauri desktop window over the API (`desktop/`, merged).

**Owner-only blockers (remind once per session, don't nag):** Gemini key
rotation never confirmed; `music/energetic/` empty (CC0 measured to have
nothing usable — YouTube Audio Library is the fix); `feedback.jsonl` empty
so Advanced RAG is starved; IG/TikTok app reviews unstarted.

**Traps that cost real time — do not relearn:** start sessions in the
pipeline repo, not `E:\agent-swarm`; the in-tool worker holds code in
memory (restart after merges); probe latency is not generation latency;
subagents need tight file scope + "commit before returning" or they drift
(one built a desktop app instead of a sort function); validators must not
judge semantics (five false-rejection incidents — enumerate the bad, never
the good).

**Next work, evidence-ranked:** hooks score 2-3/5 in every critique (weakest
measured link); batch-analyse top motivational Shorts with
`tools/analyze_youtube.py`; brand/UX via /design-shotgun fresh; long-form
(designed, unbuilt); Advanced RAG once feedback exists.

Related: [[video-work-goes-three-places]], [[recall-providers-and-mcp]].
