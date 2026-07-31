---
type: build-log
project: AgentSwarm
milestone: M1
date: 2026-07-31
status: running
tags: [build, m1]
---

# B1 — M1: It's a terminal

*Built 2026-07-31. First code in the project. Compiles, launches, runs shells.*

## What exists now

A native Windows app: `app/src-tauri/target/release/agentswarm.exe`.

- **Tauri 2 shell**, Rust core. No Electron.
- **Real PTY sessions** via `portable-pty` (ConPTY on Windows).
- **xterm.js with the WebGL renderer**, falling back to canvas if the GPU context is lost.
- **Auto-tiling panes** — 1 pane fills the window, 2–4 tile 2-wide, 5–9 go 3-wide, beyond that 4-wide.
- **Profiles detected at startup** — powershell, cmd, and pwsh / wsl / claude when they exist on PATH. If `claude` is present it becomes the default profile.
- **Keys:** `ctrl+shift+T` new · `W` close · `Z` zoom · `←/→` cycle focus.

## The decisions worth keeping

**Input never queues behind output.** Each pane's reader runs on its own thread that only emits events — it never touches the pane map. The writer sits behind a separate short-lived lock. An agent dumping hundreds of KB cannot delay a keystroke, which is the exact failure this product exists to fix. Anything else would have re-imported the lag.

**Auto-tiling, not nested splits.** A cockpit that hides sessions behind tabs recreates the problem. Panes tile so every session is visible at once; zoom is the deliberate exception.

**The frontend never builds a command line.** It names a profile (`claude`, `wsl`); the Rust side decides the argv. Keeps shell-quoting out of the UI entirely.

**Bounded scrollback (10,000 lines).** Unbounded scrollback is the memory leak that eventually makes a terminal the slow thing on the machine.

**WebGL context loss is handled.** Sleep/wake and driver resets kill the GPU context. Without a fallback the pane freezes and looks like a hung agent — the most confusing possible failure in this specific product.

## Verified

| Check | Result |
|---|---|
| Frontend build | ✅ 397 KB, 100 KB gzipped, 1.6 s |
| Rust build (debug) | ✅ 4 m 40 s cold |
| Rust build (release) | ✅ 7 m 45 s, LTO + opt-level=s |
| Launch | ✅ window opens, survives 8 s smoke test |
| Binary size | **2.9 MB** release (12.0 MB debug) |
| Memory at rest | **21.9 MB** release, one pane (35.8 MB debug) |

**Not yet verified:** typing latency under heavy agent output, WSL profile end to end, multi-pane behaviour past 4 sessions, and behaviour across sleep/wake. These need a human at the keyboard.

## What M1 deliberately does not do

No transcript reading, no semantic view, no toggle, no cockpit badges. That is M2 and beyond. M1's only job is to be a terminal good enough to use every day — because if it is not, nothing built on top of it matters.

## Next

M2 — the semantic layer: read the session transcript alongside the live pane and render the raw ⇄ plain-English toggle over the same session. See [[P4 - Milestones|Milestones]].

Related: [[P1 - The Cockpit (the concept)|The Cockpit]] · [[P3 - Architecture|Architecture]]
