---
name: intro-film-state
description: "Where the AgentSwarm intro film lives, how it is built, and how to regenerate its audio"
metadata: 
  node_type: memory
  type: project
  originSessionId: 963a264a-67f8-4eb4-be53-0dd2a8acf13d
  modified: 2026-08-02T05:15:07.078Z
---

The film is a HyperFrames project at `E:\agent-swarm\intro-video\`. Read
`STORYBOARD.md` before touching it — it carries the v1 rejection diagnosis and
the three decisions that answer it. `frame.md` is design truth; `SCRIPT.md` is
the voiceover.

**Architecture (v2, 2026-08-02):** six sub-compositions. `cold-open.html` holds
frames 01+02 together so the rack-focus between them is real depth; `app.html`
holds frames 04-08 together so they hand off without cuts (composition-patterns
archetype C). The AgentSwarm UI in `app.html` is **reconstructed in HTML** from
`app/src/style.css`, not footage — it stays crisp at any camera scale.

**Because it is reconstructed, the film may not claim to be unretouched.** v1
said "Nothing there was a mock. The app filmed itself." That became false the
moment the UI was rebuilt. Frame 10 is now the only real `--demo` footage and
it is labelled `real recording · agentswarm --demo`. Do not reintroduce the
claim anywhere else.

**Audio is generated locally and reproducibly:**
- Music: MusicGen (`facebook/musicgen-small`, CPU, ~5.5x realtime, seeded).
  Deps are installed. Script pattern lives in the scratchpad; beds are
  `assets/audio/bedA.wav` / `bedB.wav`.
- Voice: `npx hyperframes tts "<line>" -o out.wav --voice am_michael --speed N`
  (Kokoro, offline). Regenerating changes durations — always re-measure with
  ffprobe and retime the scenes; real voice duration overrides estimates.
- SFX: the media-use bundled Pixabay set, copied into `assets/audio/sfx/`.
  Commercial-free, no attribution required.
- `scripts/build-audio.py` mixes all three into one `master.wav` with the bed
  side-chain ducked under the voice. Change a cue there, not in a composition.

A licensed music track replaces the generated bed by overwriting `bedA/bedB`
and re-running that script — no scene rebuild needed.

Deliverables: master in `renders/`, web encode at `site/intro.mp4`. Note
`site/index.html` still plays the raw `agentswarm.mp4`, not the film.

See [[film-craft-feedback]] for what gets rejected, [[social-video-format]] for
the feed-post format he wants next.
