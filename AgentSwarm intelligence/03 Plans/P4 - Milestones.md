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

## What is built, and what is still unproven

Every milestone has shipped. **Four of the five exit tests have not been run**,
because all of them require using it for real rather than building more:

- M1 — "my daily driver, I do not switch back" — needs a week
- M2 — "the demo makes one teammate say whoa" — needs a teammate
- M3 — "five busy sessions, nothing missed" — needs five real sessions
- M4 — met: the morning swarm is one command

The next honest move is the [[P7 - Baseline Log (fill daily)|baseline week]], not
M5. There is no M5 in this plan.

Log progress in [[B1 - Build Log|Build Log]]. Decisions go to [[Decision Log]].
