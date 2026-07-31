---
tags: [architecture]
---

# Architecture

## The dual-view trick

```
   ┌────────────────────────── AgentSwarm (Tauri 2, Rust core) ─────────────────────────┐
   │                                                                                    │
   │  Pane grid ──┬── Pane = ConPTY ⇄ xterm.js (WebGL)   ← raw view (authentic)         │
   │              │                                                                     │
   │              └── Transcript watcher (JSONL, per session) → semantic timeline       │
   │                        │                                    ← plain-English view   │
   │                        └── session ⇄ pane correlation                              │
   │                                                                                    │
   │  Hooks (waiting/working/idle signals) → badges, chime, needs-attention rail        │
   │  Recipes + policy profiles → launch/config layer (uses CC's own permission config) │
   └────────────────────────────────────────────────────────────────────────────────────┘
```

- **Interaction truth:** the PTY. **Understanding truth:** the transcript. Two views over one session — never two systems.
- Wait-state resolution: hooks have no "resolved" event → resolve from transcript activity + PID liveness ([[R2 - Claude Code Internals|Claude Code Internals]]).

## Stack

- **Shell:** Tauri 2 (Rust core — light, fast, native Windows feel)
- **Terminal engine:** xterm.js + WebGL renderer (don't reinvent VT100 — innovation budget goes to the semantic layer)
- **PTY:** ConPTY (Windows) / native PTY (WSL shells hosted transparently)
- **Semantic layer:** Rust transcript watcher → structured events → UI timeline

## Non-goals (v1)

- No VT emulator from scratch · no session-ownership platform · no team features until the builder loves it solo · no performance claims about Claude itself (only about our rendering/input path — which we benchmark)
