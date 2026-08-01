---
milestone: M7
date: 2026-08-01
commit: 32c7d5b
status: shipped
---

# B7 — M7: It Survives

Three things a terminal you live in has to do that this one could not.

## A pane comes back

A session ends — `/exit`, a crash, the machine sleeps. Until now the only
recovery was to close the pane and open a new one, which appends to the end of
the grid and **loses the arrangement you built**. In a nine-pane cockpit that is
the whole point of the cockpit.

A restarted pane keeps its slot, its label, its folder and its policy. Only the
process is new.

Terminal construction and process spawning were pulled out of `newPane` so
restart runs the *same* code path rather than a second one that drifts from it.

## The app comes back

The layout is written **on every change, not on exit**. A process that crashes
never reaches an exit handler, and after a crash is exactly when you want your
arrangement back.

Reopened on next launch when no swarm was named, announced rather than silent,
skippable with `--fresh`.

Verified end to end, in the real app:

```
run 1   agentswarm --swarm morning   → pane 1 (swarm), pane 2 (shell)
disk    last-layout.json             → swarm/claude, shell/powershell
run 2   agentswarm                   → reopening 2 pane(s) from last time
```

## The thresholds move

M3's numbers were chosen by watching one machine for forty seconds. The M3 build
log said that if "waiting" ever fired falsely, *"the number to change is
`BURST_FLOOR`"* — which was useless advice, because changing it meant editing
source and rebuilding.

**The baseline week is running now.** If the app cries wolf on Tuesday, that has
to be fixable on Tuesday, by the person it lied to.

`.agentswarm/settings.json`:

| key | default | what it does |
|---|---|---|
| `quiet_ms` | 2000 | below the throughput floor this long = not working |
| `stuck_ms` | 8000 | outstanding tool + no output this long = **waiting on you** |
| `burst_floor` | 800 | decayed bytes that count as progress, not a repaint |
| `scrollback` | 10000 | lines kept per pane |
| `feed_max` | 2000 | cards kept by the merged timeline |
| `restore_layout` | true | reopen what was open |

A partial file keeps the defaults for everything else. A broken one falls back to
defaults **and says so**, rather than running on numbers nobody chose. The
palette writes the file for you — nobody tunes a file they have to invent.

A test asserts the tuning actually takes effect: ten seconds of silence trips the
8 s default and does **not** trip a 30 s threshold the user chose. Settings that
silently did nothing would be worse than no settings.

## Verified by operating it

| exercised | result |
|---|---|
| restored layout | 2 panes with labels, not a lone default |
| layout persisted | written after opening |
| pane killed → restart | grid order unchanged, alive again, respawned |
| settings file | written, path reported |
| console errors | none |

26 JS tests · 25 Rust tests.

## A correction worth recording

I spent several rounds chasing a restore announcement that appeared never to
fire. **It fires.** My probes were running more than four seconds after page
load, past the flash's own timeout — the measurement window was wrong, not the
code.

Worth writing down because it is the opposite of this project's usual failure. The
habit built since M1 is to distrust the app; here that habit produced a
confident hunt for a bug that did not exist. A measurement needs checking as
carefully as the thing it measures.

## Where this leaves the project

M1 terminal · M2 understanding · M3 attention · M4 habits · M5 reach · M6 memory
with receipts · **M7 survival**.

Seven milestones. The unproven thing has not moved, and cannot be moved by
building an eighth: **four exit tests still need a week of real use.** [[P7 -
Baseline Log (fill daily)|The baseline week]] started 2026-08-01 and is still
empty.

M7 is at least the milestone that makes that week easier to run — the app now
survives restarts, and its thresholds can be corrected the day they are wrong.

See [[B6 - M6 Why Is This Line Here]] · [[B5 - M5 Drive Review Remember]] · [[P4 - Milestones]]
