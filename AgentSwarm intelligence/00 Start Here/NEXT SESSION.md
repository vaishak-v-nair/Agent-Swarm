---
written: 2026-08-01
purpose: resume point — read this first
---

# NEXT SESSION — start here

The state of everything, and what remains. Written at the close of the publish
sprint ([[B13 - The Publish Sprint]]).

## Where things stand

The app is **feature-complete for launch and verified by machinery, not claims**:
- 37 Rust + 28 JS tests · `npm run verified` = tests + smoke on the real binary
- `agentswarm --doctor` — seven checks, every failure prints its fix
- `npm run record` — the app films itself driving its own UI (`--demo`)
- Error-dialog bug fixed at the OS level (Job Object; 0 orphaned processes)
- `site/` — self-contained website, ready to deploy as-is to Vercel
- `site/intro.mp4` — 30.5s edited film, seven shots, all real footage
- Fresh MSI at `app/src-tauri/target/release/bundle/msi/`

Launch: `.\agentswarm` from the repo, or `scripts\add-to-path.ps1` once.

## Publish blockers — only Vaishak can decide

1. **No LICENSE file.** The site says "open source"; the repo has no licence.
2. **The vaults are inside the repo.** `AgentSwarm intelligence/` holds private
   session transcripts. Publish from a clean repo, or move the vaults out.
3. **Unsigned MSI.** SmartScreen will warn. The site says so honestly; a signing
   cert removes it later.

## Build queue for the next session

1. **`/hyperframes` with [[../intro-video/BRIEF.md|intro-video/BRIEF.md]]** — the
   properly-animated film. The brief is complete; a fresh session runs it with
   zero questions. Add: licensed music, and 15s of Vaishak on camera if recorded
   (the one gap between our film and the reference).
2. **`/design-shotgun`** — never ran (context died twice). Point it at
   `app/src/style.css` + a fresh `npm run record` frame.
3. **The 11-section deep review of [[P8 - CEO Review, the Verification Gap|P8]]**
   — recorded as an unresolved decision in P8 itself.
4. **Deploy `site/`** to Vercel; wire the MSI download link.
5. **THE BASELINE WEEK** — armed 2026-08-01, still **zero entries**. Four exit
   tests still need real use, and no amount of building substitutes. `log A
   glance <what happened>` from any terminal.

## The rules this project runs on (hard-won, do not relearn)

- **Never claim verified without running it.** Five user-found bugs in minutes
  taught this; `npm run verified` now enforces it.
- **Backslashes never travel through scripted replacements.** Seven escaping
  bugs. Write/Edit only; Rust builds paths; fixtures live in files.
- **Drive the UI before shipping** — `app/harness.html` (browser, mocked IPC,
  `window.__calls`) and `--demo` (real binary, self-driving).
- **Never steal focus on a machine someone is using.** A keystroke once landed
  in a game. Recording watches; the demo drives from inside.
- **A wrong reading is worse than no reading** — degrade by saying so
  (semantic layer, peek filter, doctor, the website's honest section).
- **Calm panel, urgent pilot.** Brand colour is identity, never alarm. Nothing
  loops or pulses; motion only explains change.
- Vocabulary is settled in [[../01 Identity/I1 - What Things Are Called|I1]] —
  one word per concept. A pane in the rail is *folded*; a *card* is a
  transcript entry, only that.

## Where everything lives

| what | where |
|---|---|
| build logs B1–B13 | `04 Build Logs/` |
| plans, P8 CEO review, baseline log P7 | `03 Plans/` |
| vocabulary I1 | `01 Identity/` |
| QM research R1/R2 | `02 Research/` |
| hyperframes brief | `intro-video/BRIEF.md` |
| global mirror | `E:\Second Brain\AgentSwarm\` |
| machine memory | `C:\Users\vaish\.claude\projects\E--agent-swarm\memory\` |
