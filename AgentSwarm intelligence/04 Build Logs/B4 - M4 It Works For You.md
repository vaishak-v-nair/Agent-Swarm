---
milestone: M4
date: 2026-08-01
commit: d120c98
status: shipped
---

# B4 — M4: It Works For You

The exit test for this milestone was *"the morning swarm is one command."*
It is now literally one command:

```
agentswarm --swarm morning
```

## Recipes

A recipe is the set of panes you always open together — folder, label and policy
for each — read from `.agentswarm/recipes.json`, **project first** so a repo can
ship the swarm that works on it, falling back to `~/.agentswarm/recipes.json`.

```json
{ "name": "review",
  "panes": [{ "profile": "claude", "label": "reviewer",
              "args": ["--permission-mode", "plan"] }] }
```

You can also arrange panes by hand and pick **save this swarm as a recipe**.
Keeping a layout you have actually tried beats authoring JSON for one you
haven't.

### Per-pane policy is a recipe field, not a feature of this app

A pane runs `claude --permission-mode plan` because the recipe says so.
AgentSwarm passes those flags through verbatim and invents none of its own —
**whatever a pane is allowed to do, you wrote down.** That line matters: this app
should never be the reason a permission check didn't happen.

The flags are single-quoted into PowerShell so that a file on disk cannot become
executable script. That quoting has its own test, including the obvious break-out
attempt (`'; rm -rf /; '`) and `$(whoami)`.

## The command palette — `ctrl+shift+P`

Now the only chord worth memorising. Everything else — recipes, panes, views,
saving — is three letters and enter. Typing `mrn` finds `morning`.

A cockpit that answers every question with a new keyboard shortcut eventually
has more shortcuts than anyone remembers.

## The merged timeline — `ctrl+shift+M`

The plan listed this under M3 and **M3 did not build it.** It belongs here.

Per-pane views answer *what is this one doing*. With five sessions running, the
question you actually have is *what happened, in what order, across all of them*
— and a grid of terminals structurally cannot show that. It is the original
complaint, in the original words:

> "It places everything in order which claude CLI lacks."

Ordering needed a real timestamp, so a card now carries its ISO string rather
than a pre-formatted clock face — `16:33` cannot be sorted against another
session's `16:33`.

## Three defects found while building

**1 — The palette would have silently dropped good matches.** `score()` used `-1`
as both the no-match sentinel and the filter threshold. But real matches score
negatively too: `mrn` against `swarm  morning` is `-8`. Every loose match would
have been filtered out as "no match". *The test caught it before the build did.*

**2 — A malformed `recipes.json` produced zero recipes and zero explanation.**
Found by accident: a heredoc mangled the backslashes in my own recipe file, and
the feature simply did not exist — no error anywhere. The same shape as the blank
panes in M1, in a product whose whole argument is that silence is the bug.
Problems now travel with the result and are reported on screen.

**3 — A `--swarm` name that matches nothing** quietly opened a default pane,
turning a typo into a confusing morning. It says so now.

## Verified

| | |
|---|---|
| Rust tests | 16 |
| JS tests | 25 |
| `--swarm morning` | 2 labelled panes, one command |
| `--swarm review` | reaches the process as `claude '--permission-mode' 'plan'` |
| Recipe loading | `2 recipe(s): morning, review` |
| `--permission-mode plan` | confirmed a real flag via `claude --help` |

## Not verified

The palette and timeline were **not** driven end-to-end. A fullscreen game was
running, and raising the window to send keystrokes puts them in someone else's
application — which already happened once during M3 testing. The rendering was
checked against the real stylesheet in a preview file instead. The logic beneath
both (ordering, matching) is unit-tested; the wiring between them is not.

## Where the four milestones landed

- **M1** gave it a terminal.
- **M2** gave it understanding.
- **M3** gave it attention.
- **M4** gave it habits.

What no milestone gave it is **memory across sessions** — the cockpit still
cannot answer *"what did I decide about this yesterday"*. That is where
[[Recall]] and this app meet, and it is the honest next thing.

The other honest next thing: **none of the exit tests that require a week of real
use have been run.** M1's was "it is my daily driver and I do not switch back."
That is still unproven, and no amount of further building will prove it.

See [[B3 - M3 Does This Pane Need Me]] · [[B2 - M2 The Semantic Layer]] · [[B1 - M1 The Terminal]] · [[P4 - Milestones]]
