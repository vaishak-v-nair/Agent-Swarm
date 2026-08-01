---
milestone: M10
date: 2026-08-01
commit: 2039bb4
status: shipped
---

# B10 — M10: Stage

The report: *"When a user opens 4 or 10 or multiple panes, the contents/texts
will be seen very tiny. Make a smooth pop-up pane like Apple does. Or else, you
can bring up a 20x better idea."*

## The 20x idea was to delete the premise

A pop-up would have helped. But the premise underneath is the actual bug:

> A uniform grid assumes you read every session at once. **You don't.** You read
> one and monitor the rest.

Tiling nine panes buys nine unreadable terminals to satisfy a need nobody has.
The grid was solving the wrong problem, and had been since M1.

## Stage

The pane you are reading gets the whole room. Measured: **864px staged against a
58px card.** The others become live cards in a rail — state, elapsed time, and
their most recent line, which is enough to decide whether to switch.

Nothing was lost that was being used. The [[I1 - What Things Are Called|muster
rail]] still shows every pane at once; that is what it is for.

**Panes move between containers; they are never rebuilt.** Verified — after a
switch there are still exactly two xterm instances, so scrollback, process and
cursor position all survive. `ctrl+shift+G` returns to the grid, and the default
lives in `settings.json` for anyone who disagrees.

A card carries its session's last line with ANSI stripped, updated only when the
line actually changes so a repainting TUI does not thrash it. Cards hold a
minimum height, because a rail that twitches as output arrives is the ambient
motion M9 spent its time removing.

## Smoother

10px radii, softer shadows, translucent panels over the live cockpit with a
backdrop blur, and transitions on the decelerate curve macOS uses
(`cubic-bezier(.32,.72,0,1)`).

## Two deliberate reversals

**Chrome is proportional again.** M9 set the whole interface in monospace for
instrument feel. Apple's own pro tools — Logic, Final Cut — are dark and dense
and instrument-like while setting chrome in a proportional face and reserving
mono for data. That is the better rule. Mono now stays where alignment carries
meaning: elapsed times, counts, paths, diffs, terminal output.

**Motion is allowed, narrowly.** M9 said nothing animates. That was the right
instinct aimed slightly wrong. The refined rule:

> Animation that **demands attention** is banned — that was the needy pulse.
> Animation that **explains a change** is the opposite, and is why a stage
> switch does not read as a page reload.

Transitions only, never loops, all of it inside the reduced-motion guard — which
finally has something in it.

## Verified

| checked | result |
|---|---|
| layout at boot | `stage`, from settings |
| staged vs card | 864px vs 58px |
| carded terminal | hidden, process untouched |
| terminal reuse across switch | 2 xterms before, 2 after — none rebuilt |
| card last line | ANSI stripped, updates on change |
| `ctrl+shift+G` | stage ⇄ grid, both directions |
| chrome / data type | Segoe UI Variable / Cascadia Mono |
| console errors | none |

26 Rust tests · 26 JS tests.

## Known limits

- A carded pane keeps the size it had when it was staged. Correct — resizing a
  running program down to card width would reflow its output — but it means the
  first repaint after switching can look briefly stale.
- The rail is fixed at 252px and does not adapt to very narrow windows.
- No drag-to-reorder in the rail.

## Where this leaves the project

Ten milestones. M9 and M10 were both driven by someone looking at the thing and
saying what was wrong with it, which no amount of building produces on its own.

The [[P7 - Baseline Log (fill daily)|baseline week]] started 2026-08-01 and is
still empty.

See [[B9 - M9 An Instrument Not An Assistant]] · [[I1 - What Things Are Called]] · [[P4 - Milestones]]
