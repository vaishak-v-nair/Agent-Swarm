---
tags: [video, index]
project: AgentSwarm
updated: 2026-08-02
---

# AgentSwarm — video work

The global mirror of `E:\agent-swarm\intro-video\`. Second of the three places
every video artefact lives (project → **global** → Video Intelligence).

## What shipped

**The intro film** — 54.2s, 1920×1080/30fps, with sound.
Web encode at `E:\agent-swarm\site\intro.mp4` (6.0 MB). Master in
`E:\agent-swarm\intro-video\renders\`.

Three cuts; two rejected. The full case study, written so another project can
use it, is at
[[AgentSwarm — intro film|Video Intelligence → AgentSwarm intro film]].

## Files here

| File | What it is |
|---|---|
| `BRIEF.md` | confirmed intent — the only routing artefact the workflow reads |
| `STORYBOARD.md` | the plan, plus the v1 and v2 rejection diagnoses |
| `SCRIPT.md` | the voiceover, and the words it refuses to use |
| `frame.md` | design truth — palette, type, geometry, motion law |
| `build-audio.py` | the whole audio mix: music + voice + 35 SFX cues, ducked |

## The two decisions worth remembering

1. **The app's "nothing animates" law governs the app, not the film.** Applying
   it to the film produced an inert cut that was rejected. `style.css` was never
   edited; the film gained ambient life instead.
2. **The UI in the film is reconstructed HTML, not capture** — so the film may
   not claim to be unretouched. Frame 10 holds the real `--demo` recording and
   labels it. Do not reintroduce an "it filmed itself" claim anywhere else.

## Still open

- Licensed music to replace the generated MusicGen bed (drop into
  `assets/audio/bedA.wav`/`bedB.wav`, re-run `build-audio.py`).
- `site/index.html` still plays the raw `agentswarm.mp4`, not the film.
- The 4:5 feed clip — format spec in
  [[Pacing — what the numbers say|Pacing]].
