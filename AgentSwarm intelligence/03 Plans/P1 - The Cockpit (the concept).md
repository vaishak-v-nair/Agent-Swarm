---
tags: [concept]
---

# The Cockpit

Not a dashboard next to a terminal (the third-party field). Not a chat app instead of a terminal (the vendor's desktop app). **The terminal itself, rebuilt around the agent.** That's the whitespace — see [[R1 - Landscape and Competitors|Landscape]].

## Four pillars, fused

1. **Understands** — semantic timeline per session: collapsible tool-call cards, real rendered diffs, test pass/fail chips, plain-English narration per block. Everything in order. See [[P2 - The Toggle|The Toggle]].
2. **Fast** — GPU-rendered, virtualized scrollback, input path decoupled from agent output. Typing stays instant no matter how much five sessions spew. Sidesteps the Windows lag bug entirely (see [[R2 - Claude Code Internals|Claude Code Internals]]).
3. **Automates** — session recipes ("morning swarm": repos + prompts + layout in one command), per-pane policy profiles mapped to Claude Code's own permission config. Never keystroke puppeting.
4. **Cockpit** — pane grid that knows every pane is Claude: waiting badges, chime, needs-attention rail, one merged cross-session timeline.

## The soul

If it existed tomorrow, you'd open it instead of Windows Terminal because: your agents stop being walls of text and become **legible, ordered, delegable work**.

Related: [[P3 - Architecture|Architecture]] · [[P4 - Milestones|Milestones]]
