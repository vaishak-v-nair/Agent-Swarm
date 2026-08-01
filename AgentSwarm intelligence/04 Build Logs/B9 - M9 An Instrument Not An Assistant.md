---
milestone: M9
date: 2026-08-01
commit: 0b216f2
status: shipped
---

# B9 — M9: An Instrument, Not An Assistant

The feedback: *"Current AgentSwarm window terminal doesn't look good in UIUX and
it does shows that needy feel from user perspective."*

The second half is the useful half, and it was right.

## The diagnosis

**The app was using its brand colour as its alarm colour.**

Every alert was the product shouting its own name — pink pane border, pink
pulsing dot, pink `needs you`, a bullet in the window title, a taskbar flash,
and red text in which the app accused *itself* of being broken. Six separate
mechanisms all firing in the same colour as the logo.

That is what "needy" means in an interface: it behaves like something that wants
to be noticed, rather than something that reports.

> A flight deck does not say "I need you." It lights a steady annunciator and
> trusts the pilot to read it. **Calm panel, urgent pilot** — never the reverse.

## What changed

**Colour has a job now.** Brand pink is the wordmark and nothing else. Status
follows annunciator convention: amber attention, desaturated green running, cool
blue advisory, grey inactive, rose held back for something genuinely broken.

**Nothing animates.** Verified — zero elements with a running animation. The
breathing dot is gone.

**Language was half the problem.**

| was | is |
|---|---|
| `needs you` | `waiting · 12m34s` |
| `● 2 needs you — AgentSwarm` | `AgentSwarm · 2 waiting` |
| `2 needs you · 3 working` | `2 waiting  3 running` |
| red: *this pane started but received no output* | amber: *claude started but has produced no output* |

`needs you` named the app's want rather than the pane's condition. An instrument
reports a state; the person reading it decides whether it is urgent.

**Vocabulary settled** in [[I1 - What Things Are Called]]. `recipe` was the file
format's word leaking into the interface while the palette said `swarm` for the
same object. One word now: **swarm**.

## The aesthetic decisions

**Warm graphite, not black.** `#141519` rather than near-black. Black plus one
bright accent is the house style of every dark developer tool; a warm cast puts
the panel closer to equipment than to a void.

**The chrome is monospaced** — labels, states, elapsed times, the palette — on a
character grid, with tabular figures so times do not jitter as digits change.
This is an instrument for reading machine output, so it uses the machine's grid.

**Prose stays proportional.** Card bodies, reasons, search results. Monospaced
paragraphs are a punishment. That exception is the whole rule, and it is what
stops the monospace decision being a costume.

**The terminal palette was retuned to match.** The terminal is the largest
surface in the app; a stylesheet that disagrees with it is how an interface
stops looking designed and starts looking assembled.

## The signature: the muster rail

One lamp per pane, in pane order, across the top bar.

```
agentswarm  ▪▪▪▫   1 waiting  2 running
```

With nine sessions this is the difference between reading the room and auditing
nine headers, and it costs one line of chrome. Click a lamp to go to that pane.
Squares, not dots — an LED on a panel is square; a notification is round.

## Verified

Driven through `harness.html`:

| checked | result |
|---|---|
| tokens | `--bg #141519`, `--attn #d9a05b`, `--run #6fae86`, `--adv #7f9dc0` |
| muster rail | renders per pane, tracks state, labelled per pane |
| every annunciator state | green / amber / blue / grey / hollow, all correct |
| animation | **0 elements animating** |
| chrome font | Cascadia Mono |
| brand colour in status | none — wordmark only |
| console errors | none |

26 Rust tests · 26 JS tests.

## What I did not do

- No new capability. M9 is entirely a design and language pass.
- The window is still Windows-only and still has no light theme.
- The `recipes.json` filename kept its old name so existing configs keep working.
  The concept is a swarm; the file has not caught up.

## Where this leaves the project

Nine milestones. This is the first one aimed at how the product *feels* rather
than what it can do, and it came from the only source that can produce that kind
of feedback: somebody looking at it.

Which is also the argument for the four exit tests that remain unrun. The
[[P7 - Baseline Log (fill daily)|baseline week]] started 2026-08-01 and is still
empty.

See [[B8 - M8 Someone Else Can Run It]] · [[I1 - What Things Are Called]] · [[P4 - Milestones]]
