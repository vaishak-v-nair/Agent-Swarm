---
tags: [research]
---

# Landscape (July 2026)

What the review cycles established — kept because it *supports* the cockpit.

## The field

- **Anthropic desktop app** (April 2026 redesign): workspace of N parallel sessions, auto-worktrees, in-app approve/deny, Windows-native. **A chat UI, not a terminal.** Documents that it *cannot see terminal-CLI sessions*.
- **Agent view (CLI built-in):** needs-input notifications, awaiting counts — only while open; no escalation, no wait measurement.
- **Third parties** (Nimbalyst, Superset, CodeAgentSwarm, Composio AO): kanban/orchestrator dashboards *next to* stock terminals.
- **Known bug:** severe Windows CLI keystroke lag (claude-code#41501), absent under WSL.

## The whitespace

Nobody rebuilds **the terminal itself** around the agent. Dashboards beside terminals, chat instead of terminals — but the surface people stare at all day is still dumb scrollback. That's ours.

## Positioning

The desktop app is for chat people; AgentSwarm is for terminal people. Different species — watch vendor releases casually, not fearfully.
