---
milestone: M2
date: 2026-07-31
commit: 170ecb1
status: shipped
---

# B2 — M2: The Semantic Layer

The toggle exists. Every pane now carries two readings of the same live session:
**raw** is the terminal, untouched, and **flow** is what actually happened, in
sentences. `ctrl+shift+E` flips one pane; `ctrl+shift+A` flips the cockpit.

This was the original pitch, from the first sentence of the first session:
*"we can add toggle option where a user want to see the execution / user wants to
see only the plain-english texts."* M1 built the terminal. M2 is the part nobody
else has.

## The bug that made M1 blank

Every pane in M1 showed nothing. The cause was not in the terminal code at all:
`src-tauri/capabilities/` did not exist.

Tauri 2 grants a webview **nothing** by default. Without a capabilities file,
`listen()` is denied, so the frontend never registered a single event handler —
while Rust read the PTY perfectly and emitted into the void. Custom commands
(`pty_spawn`, `diag`) kept working, because app commands are not gated the way
core APIs are. That is what made it so hard to see: the app looked alive.

Nothing logged an error, because a denied listener rejects a promise and the
`.catch` was empty.

> A silent failure, in the product whose entire thesis is that silent failures
> are the problem.

Two changes, so this class of bug cannot hide again:

1. A denied listener now announces itself loudly instead of failing politely.
2. A pane that receives no bytes within 3 seconds **accuses the app on its own
   screen**, in red, rather than sitting there looking calm.

## How the layer works

Structure comes from Claude Code's own JSONL transcript — never from scraping the
rendered terminal. Scraping ANSI output to guess what an agent is doing is the
approach that looks clever for a week and then breaks on every release.

- `transcript.rs` resolves the project directory, tails the session file, and
  turns each line into at most one card: `you`, `claude`, `tool`, `result`.
- Cards stream over the same event bus as the PTY bytes.
- Both views stay mounted, so switching is a change of reading rather than a
  reload — and cards keep arriving while you're looking at raw, so flipping
  never shows a gap.
- **The terminal does not depend on any of this.** If the semantic layer never
  attaches, the pane above it is untouched.

## Measured, not asserted

`examples/semcheck.rs` runs the *real* watcher over *real* transcripts, so the
coverage number is reproducible.

| | lines | note |
|---|---:|---|
| Total transcript lines | 3,661 | 4 files on this machine |
| Visible conversation | 2,121 | assistant text, tool calls, results, user turns |
| **Became cards** | **2,097** | **98.9%** |
| Thinking blocks | 630 | deliberately not rendered |
| UI state | 910 | `attachment`, `mode`, `custom-title`, `queue-operation` |
| Missed | 24 | empty tool results |

Live tail: **66 cards in 12 seconds**, reading the session that was building it.

## Two findings that only appeared against real data

Fixtures would have missed both.

**Slash commands were being deleted.** They're stored as XML-ish tags —
`<command-name>/office-hours</command-name>` — so they read as machinery and got
discarded with the genuine noise. They are the user typing. This is the *same
bug* that erased the original pitch for this app from the vault transcripts. It
now has a test.

**Attach-on-fresh-file was wrong.** The first version waited for a recently
modified transcript, which sounds correct and is not: a session that is running
but *idle* has an old mtime. So the most common case — attach to work already in
progress — never attached, and the feature looked dead. It now attaches to the
newest transcript immediately and follows this pane's own session once it starts
writing.

## Testing note

I tried to verify the flow view by raising the window and sending a keystroke.
A fullscreen game was running, so `ctrl+shift+E` went into Rocket League instead.
Stealing focus on a machine someone is actively using is the wrong way to test —
the diagnostic (`pane 1 semantic layer live`) and `semcheck` prove the same thing
without touching anyone's screen.

## Next

- **The Toggle is half-built.** Flow shows *what happened*. It does not yet show
  *what is happening now* — the one-line "waiting on a permission prompt" state
  that the baseline week exists to measure. That is M3.
- Multiple panes in the same folder still race for the same transcript.
- Cards are capped at 500 per pane; older ones drop silently.

See [[B1 - M1 The Terminal]] · [[P7 - Baseline Log (fill daily)]]
