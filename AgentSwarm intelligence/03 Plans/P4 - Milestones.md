---
tags: [build]
---

# Milestones

Construction sequence — every milestone ships the same product, more finished. No evidence gates; we build.

## M1 — It's a terminal (~2–3 CC days)
- [ ] `git init` E:\agent-swarm, Tauri 2 scaffold
- [ ] Pane manager (split/close/zoom)
- [ ] ConPTY integration; launch Claude Code + plain shells (Windows + WSL)
- [ ] xterm.js WebGL rendering; input latency decoupled from output
- [ ] **Exit test:** it's my daily driver and I don't switch back

## M2 — It understands (~3–4 CC days)
- [ ] Transcript watcher + session⇄pane correlation
- [ ] Semantic timeline: tool cards, diffs, status chips
- [ ] [[P2 - The Toggle|The Toggle]] — raw ⇄ semantic, one keystroke
- [ ] Parser fixtures, version pinning, graceful degradation
- [ ] **Exit test:** the demo makes one teammate say "whoa"

## M3 — It's a cockpit (~2–3 CC days)
- [ ] Multi-session grid; waiting badges + chime + needs-attention rail
- [ ] Merged cross-session ordered timeline
- [ ] **Exit test:** five busy sessions, typing instant, nothing missed

## M4 — It works for you (~3–4 CC days)
- [ ] Recipes (named swarm launches)
- [ ] Per-pane policy profiles (CC permission config)
- [ ] Narration polish, command palette
- [ ] **Exit test:** the morning swarm is one command

Log progress in [[B1 - Build Log|Build Log]]. Decisions go to [[Decision Log]].
