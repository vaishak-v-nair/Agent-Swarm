---
name: film-craft-feedback
description: "What Vaishak rejects in AgentSwarm videos — inert motion, slow pacing, dark music; and the app-rule-is-not-film-rule lesson"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 963a264a-67f8-4eb4-be53-0dd2a8acf13d
  modified: 2026-08-02T05:14:37.203Z
---

Two rounds of rejected intro film, both instructive.

**Round 1 ("looks like a draft"):** two motion moves in 59s (a y-translate
cascade, a linear scale push), seven hard cuts with nothing carrying across, no
graphic system beyond text and rounded rectangles, captions in a detached rail
with no visual link to the pixel they named, and no audio. His words: "random
zoom, random text in somewhere, no audio."

**Round 2 ("looks soooo good, but"):** background music read as *scary*; voice
and video too slow — "too much time taken to move on to next"; some text not
centered; a swirl audio effect (`whoosh-cinematic`) that did not fit.

**Why:** The root cause of round 1 was applying the *app's* motion law
(`app/src/style.css`: "nothing animates; nothing loops or pulses") to the
*film*. That law protects a developer working beside a status panel. A film
someone chose to press play on is a different medium — there, inert is not calm,
it is dead. A rule earned in one medium does not transfer to another just
because the same brand is on both.

**How to apply:**
- Give the film ambient life (light field, grain, vignette, glow, depth) while
  the app keeps its discipline. Never edit `style.css` for the film.
- Pace for a feed, not a boardroom. He measures slowness against 10-21s
  reference clips; holds longer than ~1.5s after the last motion read as dead.
- Music must be bright and forward, never dark ambient drone. MusicGen prompts
  that mention "ambient pad / sparse / patient" produce something he calls scary.
- Every caption must land ON the thing it names — box, leader line, label. A
  detached rail makes any camera move look random.
- Contrast: the product's own `--dim`/`--faint` tokens fall under WCAG AA at
  video viewing distance. Lift secondary text, keep every status hue exact.

See [[intro-film-state]] and [[social-video-format]].
