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
| Launch | ✅ verified by process tree: webview + PTY + **claude.exe running inside** |
| Binary size | **2.9 MB** release (12.0 MB debug) |
| Memory at rest | **21.9 MB** release, one pane (35.8 MB debug) |

## Pressure test — the invariant, measured

The claim was *input never waits on output*. It is now measured, not asserted.

`ptybench` spawns real PTYs through the **same** `pty::spawn` the app uses, floods every pane continuously, and times a single keystroke reaching its pane while that runs.

| | 6 panes / 10 s | 13 panes / 12 s |
|---|---|---|
| Output while measuring | 34.9 MB · 3.5 MB/s | 22.2 MB · 1.8 MB/s |
| Chunks emitted | 206,328 | 139,259 |
| Keystroke p50 under load | **8.6 µs** | **11.1 µs** |
| Keystroke p95 under load | 47.0 µs | 54.1 µs |
| Keystroke p99 under load | **98.4 µs** | **240.3 µs** |
| p50 load ÷ idle | 0.58× | 0.76× |

**p99 is 0.1–0.24 ms under full load.** A human starts to feel input lag around 30 ms — this is 100× under it. The load-to-idle ratio being *below 1* means writes did not contend with readers at all; the idle samples are simply noisier (300 samples versus ~3,000).

To make this testable, `pty::spawn` became generic over a `Sink` trait. The app's sink emits webview events; the benchmark's counts bytes. The test therefore exercises the real spawn/read/write path rather than a copy of it.

Reproduce:

```
cd app/src-tauri
cargo run --release --bin ptybench -- 13 12
```

**Still not verified:** WSL profile end to end, sleep/wake behaviour (the WebGL fallback path), and how the *rendering* layer holds up at these rates — this test measures the PTY layer, not xterm.js paint time. Those need a human at the keyboard.

## What M1 deliberately does not do

No transcript reading, no semantic view, no toggle, no cockpit badges. That is M2 and beyond. M1's only job is to be a terminal good enough to use every day — because if it is not, nothing built on top of it matters.

## Next

M2 — the semantic layer: read the session transcript alongside the live pane and render the raw ⇄ plain-English toggle over the same session. See [[P4 - Milestones|Milestones]].

Related: [[P1 - The Cockpit (the concept)|The Cockpit]] · [[P3 - Architecture|Architecture]]
