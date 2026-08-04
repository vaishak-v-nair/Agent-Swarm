---
workflow: general-video
flow: companion
storyboard: no
message: "Five agents are working — this is the one window that tells you whose turn it is"
destination: website
aspect: 1920x1080
language: en
length: 72s
angle: product-intro
---

## Intent

The introduction film for AgentSwarm, for the website and social. It replaces the
30.5s ffmpeg cut at `site/intro.mp4`, which was assembled from crops and drawtext
because there was no time to animate properly. This is the animated replacement.

The audience is a developer who already runs several coding agents at once and has
felt the specific problem: something finished, something is blocked, and finding
out which means checking every window. Tone: instrument, not assistant.

## Assets

- `assets/agentswarm-seekable.mp4` — the real recording, 1280×848, 64s. The app
  driving its own UI via `agentswarm --demo`. Staged from `site/agentswarm.mp4`
  and re-encoded to 30 fps with 1-second keyframes: the 4 fps original had
  keyframes 11.5s apart, and the renderer refused to ship clips it could not
  seek accurately. Same pixels.
- `frame.md` — design truth, derived from the product's own `app/src/style.css`.

## Customizations

- **Motion blueprints** — every scene cites a blueprint or named rules; nothing is
  improvised. See `STORYBOARD.md`.
- **Designed camera on the footage** — `coordinate-target-zoom` per beat, framing
  the region that actually carries the point, rather than showing a whole window
  and hoping the viewer finds it.
- **A designed scene the footage cannot supply** — `annunciator` (frame 04). The
  colour language is the product's core idea and no single recorded frame states
  it legibly.

## Notes

- **Audio: three layers, all offline.** MusicGen music bed (deps installed on
  request), Kokoro voiceover, and the media-use bundled Pixabay SFX set. Mixed
  once in `scripts/build-audio.py` with the bed side-chain ducked under the
  voice. A licensed track can replace `bedA/bedB` without touching a scene.
- **Length is 72s**, set by the real voiceover durations rather than estimated.
- **v2 rebuild.** v1 was rejected as draft-quality. The diagnosis and the three
  decisions that answer it live in `STORYBOARD.md`. The UI is now reconstructed
  in HTML from the product's own stylesheet; real footage survives only in
  frame 10, which is the beat that is about the recording.
- Everything shown is the real recording or a real command. No invented product
  claims, no mocked UI.
- Renders locally: the film uses installed Windows system fonts (Segoe UI
  Variable, Cascadia Mono) to match the product exactly.
