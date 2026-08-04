---
project: agentswarm-intro
version: 3
mode: collaborative
message: "Five agents are working — this is the one window that tells you whose turn it is"
audience: developers running several coding agents at once
aspect: 1920x1080
duration: 54.2
fps: 30
---

# AgentSwarm — introduction film, v3

## v3 changes (2026-08-02) — the second round of feedback

Vaishak: "looks soooo good, but" — four specific notes, all fixed:

| Note | Fix |
| --- | --- |
| "background audio is scary" | The bed was a dark ambient drone. Regenerated bright and major-key. Measured, not guessed: spectral centroid went 705 Hz → 2116 Hz and energy above 2 kHz 6.5% → 23.5%. |
| "voice & video are very slow, too much time taken to move on to next" | 72s → **54.2s**. Voiceover re-synthesised at speed 1.1 (35.9s → 32.7s of speech) and every dead hold cut. The worst offender was a 3.4s gap in the cold open between the amber flip and the rack focus. |
| "some texts are not properly aligned in center" | The end card's checks were a left-aligned two-column grid under a centred wordmark, and the command pill was a 1000px box with its text hard left. Checks are now one centred row; the pill is narrowed to 740px. The proof card's stat row is centred in the frame instead of pinned to its left edge. |
| "swirl audio effect is not good for this" | `whoosh-cinematic` on the zoom-through, replaced with the short clean whoosh. Marked in `scripts/build-audio.py` so it does not come back. |

Scene lengths after the cut: cold-open 13.5→9.8, wordmark 6.0→4.6, app
29.5→22.0, annunciator 6.5→5.0, proof 7.0→5.8, end-card 9.5→7.0.

---

## v2 notes (retained — the diagnosis still stands)

v1 was rejected as draft-quality, correctly. This file records **why**, and what
v2 does differently, so the diagnosis does not have to be rediscovered.

## What was wrong with v1

| Symptom | Root cause |
| --- | --- |
| "Random zoom" | The camera pushed on a timer, not toward anything. No callout tied a caption to the pixel it described, so the move had no subject. |
| "Random text somewhere" | Captions lived in a detached bottom rail with no visual link to the UI. |
| Two moves for 59 seconds | Every text entrance was one y-translate cascade; every footage beat was one linear scale push. |
| Seven hard cuts, no transitions | Nothing carried across a scene boundary. Seven separate files, played in order. |
| Inert | The **app's** motion law ("nothing loops or pulses") was applied to the **film**. That law protects a developer working next to a status panel. A film someone chose to press play on is a different medium, and there inert is not calm, it is dead. |
| No audio | Shipped silent. |

## The three decisions that define v2

1. **The film gets life; the app keeps its discipline.** Ambient light, grain,
   vignette, parallax, depth. Still restrained — no glitch, no VHS, no neon, no
   gimmick. `app/src/style.css` is untouched.
2. **The UI is reconstructed in HTML** from the app's real stylesheet, so every
   element is individually animatable and pixel-crisp at any zoom. No more 4 fps
   upscaling.
3. **Reconstruction forces an honesty fix.** v1's "Nothing there was a mock. The
   app filmed itself." is TRUE only of real footage. Frame 10 is therefore the
   one beat that keeps the real recording, and it is the beat that is *about*
   the recording. The false claim is gone.

## Global layers (persistent, all scenes)

- Ambient amber light field, slow drift — `ambient-glow-bloom`
- Film grain — registry component `grain-overlay`
- Vignette — registry component `vignette`

These three are most of what "professional surface" means here, and v1 had none.

## Audio

Three tracks, all offline.

- **Music** — MusicGen (`facebook/musicgen-small`), **bright major-key** bed
  (`upA`/`upB`), seeded, ducked under voice. The v2 "sparse ambient" prompt read
  as scary; do not go back to it.
- **Voice** — Kokoro TTS. The VO carries the *argument*; on-screen text carries
  *labels and data*. They never say the same words. Script: `SCRIPT.md`.
- **SFX** — the media-use bundled Pixabay set (commercial-free, no attribution
  required): `whoosh`, `impact-bass-1/2`, `riser`, `key-press`, `click`,
  `click-soft`, `ping`, `chime`, `pop`.

## Frames

| # | Frame | Role | Start | Dur | Blueprint / rules |
| --- | --- | --- | --- | --- | --- |
| 01+02 | Cold open → the question | Problem | 0.0 | 9.8 | `dataviz-countup` + `kinetic-type-beats` · `ambient-glow-bloom`, `depth-scatter-assemble`, `counting-dynamic-scale`, `kinetic-beat-slam`, `depth-of-field-blur` |
| 03 | Wordmark | Product_Intro | 9.8 | 4.6 | `logo-assemble-lockup` · `depth-scatter-assemble`, `svg-path-draw`, `shimmer-sweep` |
| 04–08 | The app (5 phases, no cuts) | Product + Key_Feature | 14.4 | 22.0 | `device-surface-showcase` · `3d-camera-flight`, `coordinate-target-zoom`, `discrete-text-sequence`, `cursor-click-ripple`, `theme-crossfade-morph`, `anchored-layout-expand`, `waterfall-entry`, `nudge-curve` |
| 09 | Annunciator | Mechanism | 36.4 | 5.0 | `grid-card-assemble` · `center-outward-expansion`, `spring-pop-entrance` |
| 10 | Proof (real footage) | Honesty | 41.4 | 5.8 | `titlecard-reveal` · `waterfall-entry` |
| 11 | End card | CTA | 47.2 | 7.0 | `prompt-type-submit-generate` · `discrete-text-sequence`, `svg-path-draw` |

Total 54.2s. Rendered: `renders/intro-video_2026-08-02_11-06-34.mp4`.

The 11 frames live in **six** composition files: 01+02 share one so the rack
focus between them is real depth, and 04–08 share one so they hand off without
cuts.

## Transitions — every seam is designed, none is a bare cut

| Seam | Treatment |
| --- | --- |
| 01 → 02 | Rack focus. The five cards blur back; the question lands sharp in front of them. |
| 02 → 03 | Colour dip through graphite + directional motion blur. |
| 03 → 04 | `parallax-zoom` — the wordmark scales up and through, the cockpit is behind it. |
| 04 → 05 | No cut. Continuous camera push into the pane. |
| 05 → 06 | No cut. `theme-crossfade-morph` in place: raw terminal text becomes readable prose under a fixed anchor. |
| 06 → 07 | Whoosh; `anchored-layout-expand` springs the palette open over the same frame. |
| 07 → 08 | Palette collapses; the timeline sheet pushes up from the bottom edge. |
| 08 → 09 | Camera pulls back out of the window into the diagram. |
| 09 → 10 | The one deliberate hard cut in the film, on a bass impact — the honesty beat earns a full stop. |
| 10 → 11 | The proof card's rule extends and becomes the end card's rule. Matched element. |

## Per-frame detail

### 01 — Cold open
Black, then one amber point of light blooms. Five status cards assemble out of a
3D depth-scatter, each with a live-counting elapsed timer. Four read `running`
in green. The fifth flips to `waiting on you` in amber and springs.
SFX: sub bloom, `ping` on the flip. VO line 1.

### 02 — The question
The five cards rack out of focus. "Which one is waiting on you?" slams in on the
beat, amber, per-word. SFX: `impact-bass-1`. VO line 2.

### 03 — Wordmark
Letterforms assemble from a depth scatter, a shimmer sweeps once across the
wordmark, a hairline draws itself beneath, the tagline settles.
SFX: `riser` into `impact-bass-2`. VO line 3.

### 04 — The cockpit
The reconstructed AgentSwarm window arrives tilted in 3D and settles flat under
a decelerating camera. Rail slides in, pane fades up, the `#muster` lamps light
one by one in the top bar. SFX: `whoosh`, soft `pop` per lamp. VO line 4.

### 05 — Send work
Camera pushes to the pane. A driven cursor lands; a command types character by
character; output streams in. Everything outside the pane racks to blur.
SFX: `key-press` cluster, `click` on send. VO line 5.

### 06 — Plain english
The `mode` toggle in the pane header flips. The raw terminal text crossfades in
place into readable prose cards under a fixed anchor — the pane header never
moves. SFX: `chime`. VO line 6.

### 07 — The palette
`ctrl+shift+P`. A pill springs open into the full command palette, rows
cascading. The cursor steps down the list. SFX: `whoosh-short`, `click-soft`.
VO line 7.

### 08 — The timeline
The palette collapses; the timeline sheet pushes up. Rows stream in and the
frame scrolls along them. SFX: `whoosh`. VO line 8.

### 09 — Annunciator
The camera pulls out of the window and the three states expand outward from
centre: green `running`, amber `waiting on you`, grey `idle`, each with its
plain-English meaning. SFX: `pop` per row. VO line 9.

### 10 — Proof (the real recording)
Hard cut on a bass impact. **The real `--demo` footage**, honestly captioned:
"This is the app driving its own UI." Then the verification line.
SFX: `impact-bass-1`. VO line 10.

### 11 — End card
The rule from frame 10 extends. Wordmark, then a command pill: `agentswarm
--doctor` types out and the seven real checks tick in. "open source · Windows".
SFX: `riser`, `chime` per check, final `impact-bass-2`. VO line 11.

## Honesty rules (unchanged from v1, one addition)

- Every command shown is a real command; every check name comes from `doctor.rs`.
- **New:** reconstructed UI may only depict behaviour the app actually has, and
  the film may not claim to be unretouched footage. Frame 10 carries the real
  recording and says exactly what it is.
