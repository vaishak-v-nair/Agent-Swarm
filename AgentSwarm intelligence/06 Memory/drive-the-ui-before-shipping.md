---
name: drive-the-ui-before-shipping
description: "Stdout diagnostics and unit tests never caught the bugs a single keypress found — drive AgentSwarm's UI via app/harness.html before claiming a milestone works"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7e015ca2-f109-4f04-9752-6d67ef375631
  modified: 2026-08-01T04:00:28.894Z
---

AgentSwarm M1–M4 all shipped "verified" on stdout diagnostics and unit tests.
Vaishak typed into it once and hit a broken key path immediately. Driving the UI
afterwards found three more real bugs in under an hour.

**Why:** unit tests prove the parts work; they say nothing about whether the
assembled thing responds to a key. Every bug found this way was invisible to
both stdout and `cargo test` — a pane that never spawns when the window is
hidden looks identical to a healthy one in the logs.

**How to apply:** `app/harness.html` stands in for Tauri so `index.html` and
`src/main.js` run unmodified in a browser. It records every IPC call in
`window.__calls` and exposes `window.__emit(event, payload)` to push PTY bytes,
cards and status at the real UI. Start it with `preview_start {name:
"agentswarm-ui"}` then navigate to `/harness.html`. `examples/keycheck.rs` does
the same for the PTY half — real escape sequences to a real program, so "the key
did nothing" can be told apart from "the key arrived and there was nothing to do".

Before saying a milestone works: open the harness, press the keys, run the recipe.

Related: [[agent-swarm-design]] · [[tauri2-capabilities-gate]] ·
[[agentswarm-child-session-env]]
