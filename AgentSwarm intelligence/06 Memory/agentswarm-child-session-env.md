---
name: agentswarm-child-session-env
description: A Claude Code child process inherits CLAUDE_CODE_CHILD_SESSION and disables transcript saving — spawned panes must scrub the session env
metadata:
  type: project
---

Launching any app from a terminal running Claude Code passes ~19 `CLAUDE_*`
variables to every child. A nested `claude` that sees `CLAUDE_CODE_CHILD_SESSION`
believes it is a sub-session and turns transcript saving **off**, announcing it
only in its own banner.

Consequences, all silent: no transcript, so a transcript watcher has nothing of
its own to follow; no prompt history, so the up arrow recalls nothing;
`~/.claude/history.jsonl` had **zero** entries for `E:\agent-swarm` across every
session ever run there.

**Why:** the symptom ("up arrow doesn't work") points at the terminal, the PTY,
and key handling — all of which were correct. The cause is environmental and
invisible unless you read the pane's own first screen.

**How to apply:** `pty::scrub_session_env` in AgentSwarm removes `CLAUDE_CODE_*`,
`CLAUDECODE`, `CLAUDE_PID`, `CLAUDE_EFFORT`, `CLAUDE_AGENT_SDK_VERSION`, and —
only when a nested marker is present — `ANTHROPIC_BASE_URL`, which otherwise
points at the parent session's proxy. Any tool that spawns Claude Code needs the
same treatment. To confirm a fix, check the pane has no "Transcript saving is
off" banner, and that `history.jsonl` gains entries for that project.

Related: [[agent-swarm-design]] · [[drive-the-ui-before-shipping]]
