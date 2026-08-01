---
tags: [build]
---

# Milestones

Construction sequence — every milestone ships the same product, more finished. No evidence gates; we build.

## M1 — It's a terminal ✅ BUILT 2026-07-31
- [ ] `git init` E:\agent-swarm, Tauri 2 scaffold
- [ ] Pane manager (split/close/zoom)
- [ ] ConPTY integration; launch Claude Code + plain shells (Windows + WSL)
- [ ] xterm.js WebGL rendering; input latency decoupled from output
- [ ] **Exit test:** it is my daily driver and I do not switch back — *pending: needs a week of real use.* Build log: [[B1 - M1 The Terminal]]

## M2 — It understands ✅ BUILT 2026-07-31
- [ ] Transcript watcher + session⇄pane correlation
- [ ] Semantic timeline: tool cards, diffs, status chips
- [ ] [[P2 - The Toggle|The Toggle]] — raw ⇄ semantic, one keystroke
- [x] Parser fixtures, version pinning, graceful degradation
- [ ] **Exit test:** the demo makes one teammate say "whoa" — *not run: no teammate has seen it.* Build log: [[B2 - M2 The Semantic Layer]]

## M3 — It's a cockpit ✅ BUILT 2026-07-31
- [x] Multi-session grid; waiting badges + needs-attention rail (no chime — the window title and taskbar carry it instead)
- [x] Merged cross-session ordered timeline — *slipped to M4; built there*
- [ ] **Exit test:** five busy sessions, typing instant, nothing missed — *not run: never driven with five real sessions.* Build log: [[B3 - M3 Does This Pane Need Me]]

## M4 — It works for you ✅ BUILT 2026-08-01
- [x] Recipes (named swarm launches) — file, palette, and `--swarm <name>`
- [x] Per-pane policy profiles — a recipe `args` field, passed through verbatim
- [x] Command palette (ctrl+shift+P)
- [x] **Exit test:** the morning swarm is one command — `agentswarm --swarm morning`. Build log: [[B4 - M4 It Works For You]]

## M5 — It reaches ✅ BUILT 2026-08-01
- [x] Drive the panes — send to one, broadcast to all (ctrl+shift+P)
- [x] Diffs in the cockpit, attributed to the session that made them (ctrl+shift+D)
- [x] Memory across panes — search every transcript, cited to file and line (ctrl+shift+F)
- [x] **Verified by operating the app**, not by reading its logs. Build log: [[B5 - M5 Drive Review Remember]]

## M6 — It answers why ✅ BUILT 2026-08-01
- [x] A diff arrives with the conversation that produced it, cited to file and line
- [x] Attribution reads all history, not just panes open now (M5 limit 1)
- [x] Search requires every word, and quoting keeps a phrase whole (M5 limit 2)
- [x] Broadcast opt-out; a muted pane is visibly muted (M5 limit 3)
- [x] Verified by operating the app. Build log: [[B6 - M6 Why Is This Line Here]]

## M7 — It survives ✅ BUILT 2026-08-01
- [x] Restart a dead pane in the slot it already occupies
- [x] Layout written on every change, reopened on next launch, skippable with `--fresh`
- [x] `.agentswarm/settings.json` — the thresholds are editable the day they are wrong
- [x] Verified by operating the app, and by a real kill-and-relaunch cycle. Build log: [[B7 - M7 It Survives]]

## What is built, and what is still unproven

Every milestone has shipped. **Four of the five exit tests have not been run**,
because all of them require using it for real rather than building more:

- M1 — "my daily driver, I do not switch back" — needs a week
- M2 — "the demo makes one teammate say whoa" — needs a teammate
- M3 — "five busy sessions, nothing missed" — needs five real sessions
- M4 — met: the morning swarm is one command
- M5 — every path driven through the harness; no exit test of its own beyond real use
- M6 — same; the "why" answer is reproducible via examples/whycheck.rs
- M7 — layout survival proven by killing the app and relaunching it

The baseline week started **2026-08-01**. It is the only thing that will settle
the four open exit tests, and no further building can substitute for it.

Log progress in [[B1 - Build Log|Build Log]]. Decisions go to [[Decision Log]].
