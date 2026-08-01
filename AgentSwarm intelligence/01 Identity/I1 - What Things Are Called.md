---
tags: [identity, vocabulary]
settled: 2026-08-01
---

# What Things Are Called

One word per concept. Two words for one thing is how an interface starts feeling
muddled, and AgentSwarm had exactly that: the palette said **swarm** while the
file said **recipe**, for the same object.

## The nouns

| word | what it is |
|---|---|
| **the cockpit** | the whole window. Not a UI label — the word for the thing when talking about it. |
| **pane** | one terminal, running one session. The unit of the grid. |
| **swarm** | a named set of panes you open together, with the folder and policy for each. *Was also called "recipe". No longer.* |
| **profile** | what a pane runs: `claude`, `powershell`, `pwsh`, `cmd`, `wsl`. |
| **the muster rail** | the row of lamps in the top bar — one per pane, in pane order. |
| **stage** | the layout where one pane is at reading size and the rest are folded. The default. |
| **the rail** | the column beside the stage, holding every pane you are not reading. |
| **folded** | a pane in the rail — terminal put away, showing state, elapsed and its last line. Same pane, same process, nothing rebuilt. |
| **grid** | the older layout: every pane tiled evenly. `ctrl+shift+G`. |
| **card** | one thing that happened, read from the transcript. *Only this.* |
| **the timeline** | every session's cards, interleaved by real time. |

## The two readings

Every pane shows the same live session two ways. `ctrl+shift+E` switches.

- **raw** — the real terminal, untouched. This is the truth and it is always
  available.
- **flow** — the same session as readable cards, built from Claude Code's own
  transcript.

Both stay loaded. Switching is a change of reading, never a reload.

## The states

A pane is always in exactly one, shown in its header and as its lamp.

| state | lamp | means |
|---|---|---|
| `running` | green | producing output, or a tool is working |
| `waiting` | amber | it stopped and has not finished — **you are the blocker** |
| `your turn` | blue | Claude spoke last and stopped; nobody is blocked |
| `idle` | grey | nothing is happening |
| `ended` | hollow | the process exited |

**`waiting` was called `needs you`.** That was the single most needy string in
the product: it named the app's want instead of the pane's condition. An
instrument reports a state. The person reading it decides whether it is urgent.

## The rule behind the colours

> Brand colour is for identity. Status colour is for status. They are never the
> same colour.

The old design used the brand pink for the wordmark *and* for alarm, so every
alert was the product shouting its own name. Status now follows annunciator
convention — amber attention, green normal, blue advisory, grey inactive — and
rose is reserved for something actually broken.

Nothing in the interface animates.

## Where things live

`.agentswarm/` beside the project, falling back to `~/.agentswarm/`.

| file | holds |
|---|---|
| `recipes.json` | the swarms. *The filename kept its old name for compatibility; the concept is a swarm.* |
| `settings.json` | thresholds — `stuck_ms`, `burst_floor`, and the rest |
| `last-layout.json` | what was open, reopened next launch |

See [[B9 - M9 An Instrument Not An Assistant]] · [[P4 - Milestones]]
