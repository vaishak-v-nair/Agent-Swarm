# NEXT SESSION — Faceless-workflow-tool #2

*Handoff written 2026-08-09. Session 1 ended at commit `0778c71`, 1144 tests
green. The owner says session 2 is already running things — check for
concurrent work before assuming a quiet tree (see "Concurrent sessions").*

## START THE SESSION IN `E:\faceless-video-pipeline`, NOT HERE

Session 1 ran with cwd `E:\agent-swarm` (this repo — AgentSwarm, an
UNRELATED project) and paid for it repeatedly: dev-server config resolved
against the wrong project, and `find_dotenv` traps. Code lives in
`E:\faceless-video-pipeline`; data lives in `E:\content-workflow`. Run all
pipeline commands from the DATA directory.

## What exists and works (all merged to main, 1144 tests)

- **The tool**: `cd E:\content-workflow && python -m vidpipe.cli tool` —
  dashboard, in-process worker (Make a video now actually renders), five
  review actions, Connect YouTube, publish button, model health in plain
  words, add-channel form. JSON API under `/api/*` (status, channels, jobs,
  runs, models, connections, publish, runs/<id>/action).
- **Desktop app**: `desktop/` — the OWNER's own Tauri window over the JSON
  API (branch `desktop-canvas-inspector`, merged). `wip-desktop-app` branch
  holds an older scaffold; probably deletable after comparing.
- **Script quality chain**: craft validator (abstract-filler check, NOT a
  noun whitelist — 5 false-rejection incidents taught that), one held
  `setting` per script, setting-exclusion history (last 7 per workflow),
  keyword-led footage search with contradiction penalty (ice-skate fix),
  voice-led timing (audio == plan duration, proven), captions from own
  script, music: script's mood query leads, local_folder source with mood
  dirs at `E:\content-workflow\music\`.
- **Model cascade**: gemini-3-pro → gemini-3-flash → nemotron-3-super-120b →
  gemini-2.5-pro → 2.0-flash → llama-3.3-70b (last: 120s timeout cost) →
  deterministic. Health recorded to `state/model_health.json`, shown in the
  tool. Kimi: 404/410, retired but commented for easy re-add.
- **Self-critique**: Gemini watches finished videos (File API for >14MB),
  writes `critique.json` beside metadata. It drove the last five fixes.

## In-flight / recently landed (verify before building on)

- Setting exclusion merged `0778c71` — live-verified: mountain trail /
  pottery studio / runner's street after 3 woodshop exclusions.
- Owner may have concurrent changes via their own sessions (they authored
  and merged `desktop-canvas-inspector` mid-session-1). `git log` before
  assuming.

## Owner's standing asks, in their words

- "1M subscribers + 1B viewers" — treat as ambition, don't promise it.
- Tool should feel like n8n; "a 15-year-old can understand it"; needs a
  brand name + logo (it's still called "vidpipe"). → `/design-shotgun` in a
  FRESH session was recommended and accepted.
- "Understand every video flow in the world / feeling of humans" → next
  concrete step: batch-analyse top ~50 motivational Shorts with
  `tools/analyze_youtube.py` (works; use `gemini-3-flash-preview`), distill
  into prompt rules + vault notes.
- Knowledge sweep of GitHub/HuggingFace. 43 repos already cloned at
  `E:\content-workflow\reference-repos\` (triage note in vault: 7 worth
  reading, license findings). moviepy+beets installed in ISOLATED venv
  there — main env stays 3-dependency.

## Blockers ONLY THE OWNER can clear (remind, don't nag)

1. **Rotate the Gemini key** — an old key reached disk (since purged +
   root-caused: header auth now). Never confirmed rotated.
2. **`music/energetic/` is EMPTY** — CC0 has no usable energetic tracks
   (measured 0 of 3 queries). YouTube Audio Library → drop MP3s in.
3. **12+ runs pending review, `feedback.jsonl` empty** — Advanced RAG is
   built-but-starved until the owner clicks the five buttons.
4. Instagram/TikTok app reviews never started (2-6 weeks lead time each).

## Known gaps / next work, evidence-ranked

1. Critique-driven next fix: footage matches lines now, but critic scores
   hooks 2-3/5 consistently. Hook craft is the weakest measured link.
2. Setting exclusion catches only exact repeats — near-miss ("workshop at
   night" vs "at midnight") relies on the prompt steer. If monotony
   persists, feed recent settings to the CRITIC, not the validator.
3. Advanced RAG (retrieval over `good_to_go` runs) — blocked on (3) above.
4. Long-form videos (5-20 min) — designed (chaptered generation), never
   built. llm.py caps at 8 scenes.
5. `docs/superpowers/records/intelligence-vault-report.md` untracked —
   decide commit-or-delete.

## Process lessons that held all session (don't relearn)

- Reviewers/implementers must EXECUTE, not read — ~15 real defects found
  only by running code, incl. 3 in "my own" plans per plan.
- Tight scope per subagent + "commit before returning" + worktrees; the
  one loosely-scoped dispatch built a desktop app instead of a sort.
- Probe latency ≠ generation latency (the 45s-timeout mistake).
- The in-tool worker holds code in memory — RESTART the tool after merges.
- All vault notes go three places: project vault, Second Brain mirror,
  `E:\Second Brain\Video Intelligence\`.
