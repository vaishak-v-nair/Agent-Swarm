---
milestone: M3
date: 2026-07-31
commit: cfa6200
status: shipped
---

# B3 — M3: Does This Pane Need Me

M2 answered *what happened*. M3 answers the question that actually costs time:

> An agent asks for permission. You're in another window. Twelve minutes go by.

That sentence is the first entry in the baseline log — **T-A**, the glance that
waited. M3 is the instrument aimed directly at it.

## What it does

Every pane carries a live state:

| state | means |
|---|---|
| `working` | producing output, or running a tool |
| `waiting · Bash` | a tool was called, nothing is coming out, nothing is finishing — **you are the blocker** |
| `needs you` | the bell rang: Claude Code asked for you by name |
| `your turn` | Claude spoke last and stopped; the next move is yours |
| `idle` / `ended` | nothing is happening / the shell exited |

The bar tallies them. `ctrl+shift+space` jumps to whatever has been waiting
longest. And the **window title** carries the count out to the taskbar — the only
part of a cockpit that works when the cockpit isn't the window you're looking at.

## The rule it does not break

**Nothing scrapes the terminal for prompt text.** State comes from two signals
held honestly:

- **The bell.** Not an inference — a request. Claude Code asking for you by name.
- **An outstanding tool call + a terminal that has stopped making progress.**
  A tool that is *running* produces output. A tool that was called, is producing
  nothing, and isn't finishing is a tool waiting on a person.

The second one needs to know nothing about how the prompt is drawn, so it
survives Claude Code redrawing it. Pattern-matching prompt text would look
clever for a week and then break.

## Three things live testing found wrong

The decision logic lives in `src/state.js`, apart from the DOM — logic that
decides *when to interrupt someone* should be testable without a window. There
are 15 tests. Three of them exist because the app was caught being wrong.

**1 — A confident false alarm.** A pane reported `waiting · Bash` for a Bash call
in a *completely different session*. The watcher was catching up on an older
transcript while the stuck detector measured **this** pane's silence: two sources
cross-wired. The own-session flag now travels with the status, and no inference
is drawn from a borrowed transcript.

> This is the worst possible failure for this feature. A signal that cries wolf
> is worse than no signal, because people learn to ignore it.

**2 — "Any byte arrived" was the wrong liveness measure.** Claude Code repaints
while it sits there, so panes flipped between working and idle every couple of
seconds. Worse: a prompt that animates would have kept the stuck detector from
*ever* firing. Liveness is now **throughput**, not arrival. Forty seconds of live
observation afterwards: one transition, then stable.

**3 — A dead pane could demand attention forever.**

## A fix M3 needed from M2

M2's parser returned at most one card per line, which collapsed parallel tool
calls and made the outstanding count wrong. It now returns all of them, carrying
`tool_use` ids so a result closes the exact call it belongs to — including
**empty** results, which say nothing worth showing but are what stops a pane
falsely claiming it needs you.

## Verified

- `npm test` — 15 tests on the state machine
- `cargo test` — 8 tests on the parser
- Window title observed changing at the OS level: `AgentSwarm — 1 session`
- 40s live run: correct states, no flapping, no false alarm

## Known limit

A tool that trickles output slowly could read as `waiting`. The baseline week
will show whether that happens in practice — that is what the log is for. If it
fires falsely even once, the threshold is wrong, and the number to change is
`BURST_FLOOR` in `src/main.js`.

## Next

M1 gave it a terminal. M2 gave it understanding. M3 gave it attention. What's
missing is **memory across panes** — the cockpit still can't answer "what did I
decide about this yesterday", which is where [[Recall]] and this app meet.

See [[B2 - M2 The Semantic Layer]] · [[B1 - M1 The Terminal]] · [[P7 - Baseline Log (fill daily)]]
