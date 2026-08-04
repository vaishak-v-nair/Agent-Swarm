---
name: tauri2-capabilities-gate
description: Tauri 2 grants a webview zero permissions without a capabilities file — listen() is denied silently while custom commands still work
metadata: 
  node_type: memory
  type: project
  originSessionId: 7e015ca2-f109-4f04-9752-6d67ef375631
  modified: 2026-07-31T17:11:59.917Z
---

In Tauri 2, a missing `src-tauri/capabilities/*.json` means the webview is granted
**nothing**. `listen()` is denied and rejects, but `#[tauri::command]` functions
still work — so the app looks alive while the entire event bus is dead.

This is what made AgentSwarm M1 ship with every pane blank (fixed 2026-07-31,
commit 170ecb1). Rust read the PTY and emitted correctly the whole time.

**Why:** the symptom points at the wrong layer. Working commands imply working
IPC, so the search goes to the PTY, the terminal sizing, the frontend — anywhere
but permissions. Check `src-tauri/gen/schemas/capabilities.json`: if it is `{}`,
nothing is granted.

**How to apply:** when Rust emits and JS receives nothing in a Tauri 2 app, check
capabilities before anything else. Never leave `.catch()` empty on `listen()` —
a denied listener must announce itself.

Related: [[agent-swarm-design]]
