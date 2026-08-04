# frame.md — design truth for the AgentSwarm intro film

Brand truth comes from the product itself: `app/src/style.css`. This file restates
the parts the film needs and adds the film-only decisions (frame geometry, type
scale, camera). Where the two ever disagree, `style.css` wins.

## Concept angle

The film is the instrument describing itself. It never sells; it reports.

Every command shown is a real command and every check name comes from
`doctor.rs`. The UI is a faithful HTML reconstruction from the product's own
stylesheet, which means the film may not claim to be unretouched footage —
frame 10 carries the real `--demo` recording and says exactly what it is.

## Palette

Taken verbatim from `app/src/style.css` `:root`.

| token       | value     | use in the film                                       |
| ----------- | --------- | ----------------------------------------------------- |
| `--bg`      | `#141519` | the canvas — identical to the app's own background     |
| `--surface` | `#1b1c21` | the annunciator rows, the end-card command pill        |
| `--line`    | `#282a30` | hairline rules                                         |
| `--line-lit`| `#343740` | the one rule that draws itself                         |
| `--fg`      | `#d8d6d1` | statements, callouts                                   |
| `--dim`     | `#7d7f86` | secondary copy, the closing "open source · Windows"    |
| `--faint`   | `#55575e` | frame furniture, beat counters                         |
| `--brand`   | `#d6547a` | **the wordmark and nothing else**                      |
| `--run`     | `#6fae86` | "running" only                                         |
| `--attn`    | `#d9a05b` | "waiting on you" only — and the film's one raised voice |
| `--adv`     | `#7f9dc0` | advisory                                               |

The canvas background is *exactly* the app's background. The recording is the app
window and nothing else, so the footage dissolves into the frame: no border, no
drop shadow, no rounded card. The app's own chrome is the only edge. This is what
lets the camera push off-centre without a visible box cutting through the shot.

## Typography

| role                          | face                                                | weight | size    |
| ----------------------------- | --------------------------------------------------- | ------ | ------- |
| statements (cold open, proof) | `"Segoe UI Variable Display", "Segoe UI"`           | 600    | 76–92px |
| wordmark                      | `"Segoe UI Variable Display", "Segoe UI"`           | 600    | 132px   |
| callout rail                  | `"Segoe UI Variable Text", "Segoe UI"`              | 600    | 40px    |
| data, states, commands        | `"Cascadia Mono"`                                   | 400    | 26–52px |
| labels, counters              | `"Cascadia Mono"`                                   | 400    | 22px    |

**Contrast amendment.** Secondary chrome runs one to two steps brighter than the
app's tokens (`--dim` #7d7f86 → #8a8c93, and #969aa1 where it sits on the lighter
`--surface`). A 1080p frame read across a room is not a desktop UI read at arm's
length; the product's own values fall under WCAG AA at video viewing distance.
Backgrounds, lamps and every status hue keep the product's exact tokens.

The product's own rule, kept: **prose is proportional, data is monospaced.** A
state (`running`, `waiting on you`) is data. A sentence is prose.

All faces are installed system fonts on the render machine (`SegUIVar.ttf`,
`segoeui.ttf`, `CascadiaMono.ttf`). Nothing is fetched at render time. This film
renders locally; a cloud render would need these embedded first.

## Frame geometry

Canvas 1920×1080.

- The reconstructed window sits at `x: 200, y: 110`, `1520 × 860`, with a real
  border, radius and shadow. Being HTML, it stays crisp at any camera scale.
- Statement scenes use a centred content column, `x: 360 → 1560`.
- **Callouts land on the thing they name.** A box on the element, a leader line,
  and a label at the end of it. v1's detached bottom rail named nothing, which
  is why its camera moves read as random.
- Camera targets aim at where content actually *is*, never at a container's
  geometric centre — the pane's middle is mostly empty surface.

## Motion — amended for v2

v1 applied the product's own rule (`app/src/style.css`: *nothing animates*) to the
film, and shipped something inert. That rule exists so a status panel does not
distract a developer who is working; a film someone chose to press play on is a
different medium. **The film gets ambient life; the app keeps its discipline** —
`style.css` is untouched.

What that buys: a drifting light field, film grain, a vignette, glow blooms,
depth-scatter assembly, 3D camera flight, rack focus. What it does **not** buy:
glitch, VHS, neon, or anything that would read as a different brand. Every move
is still finite, deterministic and caused by something. Nothing yoyos.

- Arrivals are `power4.out`, 0.13–0.35s, staggered as a wave; word-level beats
  get distinct per-word entrances (`kinetic-beat-slam`), not one shared cascade.
- Camera pushes are `power3.inOut`, 0.85–1.1s.
- **Every seam is designed.** Rack focus, zoom-through, in-place theme morph,
  spring-open, vertical push, pull-back. Exactly one hard cut exists in the film
  — into the proof beat, on a bass impact, because that beat earns a full stop.
- Sound is part of motion: every seam and every landing has an SFX cue.

## Voice

Instrument, not assistant. State facts; never plead. No hype words, no
exclamation, no "revolutionary", no "effortless". The one raised voice in the
whole film is amber, and it is a question: *Which one is waiting on you?*
