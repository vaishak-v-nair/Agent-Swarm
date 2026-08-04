---
milestone: M5
date: 2026-08-01
commit: 46f57c6
status: shipped
---

# B5 — M5: Drive, Review, Remember

Three things the cockpit could not do:

- it could **watch** panes but never **talk** to them
- it could report what an agent *said* it did, but not what **changed on disk**
- it could show **live** sessions but never reach one that had **already ended**

## Drive — `ctrl+shift+P`

`send to #N` and `broadcast to every claude pane`. The carriage return is the
point: this submits.

Broadcast names its target count before you commit to it. Sending one instruction
to five agents is not an action to take by accident.

## Review — `ctrl+shift+D`

What is actually different in every pane's folder, biggest edits first, with line
counts from git's own `--numstat` and `--porcelain`. No invented parsing of
formats git does not promise. Click a file for its diff.

**The column git cannot fill is "which session touched this."** That comes from
the transcript — a tool card names the file it wrote, so a changed file is
attributed to the pane that changed it.

That is the **R dimension** in [[P7 - Baseline Log (fill daily)|the baseline log]]
— *"which-session-touched-what"* — answered directly rather than by scrolling
three terminals.

## Remember — `ctrl+shift+F`

Searches every transcript in every open pane's folder, **including sessions that
ended weeks ago**. Panes are live; transcripts outlast them.

Every hit is quoted with its transcript file and line number:

```
✦ claude  ·  7e015ca2.jsonl:1902  ·  31/07/2026, 22:03
```

> The citation is the feature, not decoration. "You decided this" is worth
> nothing without *where*, and an answer you can check beats one you have to
> trust.

This is where [[Recall]] and AgentSwarm meet — the gap no earlier milestone
filled.

Matching is plain case-insensitive substring, deliberately. When a result is
going to be quoted back with a receipt, a hit needs to be a hit.

## Driven, not assumed

This is the first milestone verified by **actually operating the app** — the
lesson from the previous session, where four milestones shipped on stdout
diagnostics and the first key a human pressed found a bug.

Every path was exercised through `app/harness.html`:

| exercised | result |
|---|---|
| changes list | 3 files, `+214 −12`, attribution `#1 claude` |
| file → diff | correct `meta` / `hunk` / `add` / `del` classes, back link |
| search | hits with citations; empty state honest |
| send to pane | arrived at the PTY as `run the tests<CR>` |
| console errors | none |

20 Rust tests · 25 JS tests.

## Known limits

- **Attribution only sees this app session.** A file edited yesterday shows no
  owner. Searching transcripts by path would fix it; not built.
- Search is substring, so it finds words, not meanings. Asking "what did I decide
  about permissions" only works if the word *permissions* was used.
- Broadcast goes to every claude pane, with no per-pane opt-out.

## Where this leaves things

M1 terminal · M2 understanding · M3 attention · M4 habits · **M5 reach**.

The unproven thing is unchanged and cannot be fixed by building: four of six exit
tests still need a week of real use. [[P7 - Baseline Log (fill daily)|The baseline week]] started today and is the only thing that will settle them.

See [[B4 - M4 It Works For You]] · [[B3 - M3 Does This Pane Need Me]] · [[P4 - Milestones]]
