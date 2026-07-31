---
tags: [research, internals]
---

# Claude Code Internals

Hard-won facts the cockpit depends on.

## Transcripts
- Sessions write structured JSONL under `~/.claude/projects/**` — the semantic layer's source of truth.
- **Undocumented format** → version-pinned parser, fixture tests per CC version, degrade-to-raw on drift. Never scrape ANSI output.

## Hooks
- Notification / PreToolUse / Stop / SessionEnd fire on session events → cheap state signals for badges.
- **No "wait resolved" event exists.** Notification says a prompt appeared; nothing says it was answered. Resolve waits from transcript activity (mtime/events) + PID liveness.
- `Stop` fires after *every* completed turn — a finished turn is **idle**, not "waiting"; never alarm on parked sessions.
- Notification message text is an unversioned contract — treat like the transcript: fixtures + graceful unknown state.
- Hook config snapshots at session start — installs need session restarts to take effect.
- Hook commands must be dumb-cheap (<10ms); a `.ps1` costs 100–300ms *per tool call per session*.

## Windows realities
- Keystroke lag bug #41501: absent under WSL → host WSL shells natively; recommend sessions run there.
- Toasts from background processes need AUMID registration + Start-menu shortcut; Focus Assist suppresses toasts *with no feedback to the sender* → chime alongside, always.
- Windows Terminal exposes no API for which tab is focused → exact-tab focus is impossible; host-window focus via PID walk is the honest maximum. (Moot inside our own terminal — we own the panes.)
