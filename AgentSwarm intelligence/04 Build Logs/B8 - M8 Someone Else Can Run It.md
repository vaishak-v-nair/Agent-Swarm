---
milestone: M8
date: 2026-08-01
commit: 67653ca
status: shipped
---

# B8 — M8: Someone Else Can Run It

M2's exit test is *"the demo makes one teammate say whoa."* It has never been
run, and **no feature could make it runnable** — a teammate had no way to install
this. `tauri build --no-bundle` produces an exe in a target directory and nothing
else.

That is the one unrun exit test that isn't about a week of solo use, so it is the
one M8 could actually move.

## There is an installer

```
AgentSwarm_0.1.0_x64_en-US.msi   1.8 MB
app/src-tauri/target/release/bundle/msi/
```

Built with `npx tauri build`. WiX resolved on its own; no manual toolchain setup.

## A first run finds something

On a folder that has never seen AgentSwarm there were no recipes, so the
palette's headline feature was an empty list and the app looked like it did less
than it does.

It now writes a starter `recipes.json`. Two rules:

- **Never overwrites.** If a recipes file exists, the user has met this feature
  and their file is the authority — including an empty one.
- **Only profiles the machine can launch.** A starter recipe that fails on first
  use is worse than no starter recipe.

Verified against a folder created for the test, with `~/.agentswarm` moved aside:

```
first run — wrote a starter recipe to …\freshmachine\.agentswarm\recipes.json
1 recipe(s): morning
seeded: morning → claude/work, pwsh/shell
```

A recipe you can read and edit teaches the format better than documentation does.

## An empty cockpit teaches

It used to say only that it was empty. On an unfamiliar machine that is the
entire first impression. It now names the four things worth knowing — the
palette, a new pane, the ordered timeline, and what changed and why.

## An about entry

Answers *"where does this keep my stuff"* without reading the source: version,
working folder, config directory, which transcripts it reads, which recipes
loaded, how many panes are open.

## A README that is not developer-only

Install, the one key worth memorising, what it does that a terminal cannot, the
configuration files, the development harness, and the known limits.

## One bug, and a rule from it

The about panel rendered `E:\agent-swarm.agentswarm` — the separator was written
as `\.` inside a JavaScript template literal, which is the escape sequence for a
full stop, not a backslash and a full stop.

> Backslashes in JS literals have now been mangled **four separate times** in
> this codebase, every time through a scripted edit: the build-log code spans,
> the recipes fixture, the harness stub, and now this.

The rule, applied rather than just noted: **paths are built in Rust with
`PathBuf` and handed over finished.** The UI never joins separators itself. The
side that owns paths should not be exporting a string-escaping problem to the
side that renders them.

## Verified

| | |
|---|---|
| Rust tests | 26 |
| JS tests | 26 |
| installer | built, 1.8 MB |
| first run | seeded and loaded on a virgin folder |
| empty state / about | driven through the harness, zero console errors |
| about paths | `E:\agent-swarm\.agentswarm` — correct after the fix |

## Where this leaves the project

M1 terminal · M2 understanding · M3 attention · M4 habits · M5 reach · M6 memory
with receipts · M7 survival · **M8 distribution**.

Eight milestones. M8 is the first one that changes what is *possible* to test
rather than what the app does: a teammate can now install it, so **"does one
teammate say whoa" is finally a question that can be asked.**

The other three exit tests are unchanged and still need a week of use:

- M1 — *my daily driver, I do not switch back*
- M3 — *five busy sessions, nothing missed*
- and the [[P7 - Baseline Log (fill daily)|baseline log]], started 2026-08-01,
  still empty

See [[B7 - M7 It Survives]] · [[B6 - M6 Why Is This Line Here]] · [[P4 - Milestones]]
