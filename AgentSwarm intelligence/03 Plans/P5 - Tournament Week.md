---
tags: [tournament, week-0]
---

# Tournament Week — evidence decides the hours

*Protocol locked 2026-07-30. One 8-hour pool, two projects. Both assignment packets run this week (near-zero build hours). The stronger evidence packet wins 100% of build hours; the other project freezes with plans intact until the winner's M1 demo lands.*

## Packet A — AgentSwarm (passive, runs while you work)

- [x] **Thresholds committed in writing — DONE 2026-07-30, locked before day 1:** T-A ≥2 · T-C ≥3 · T-R ≥3, with the 5-minute logging rule and the lag-exclusion rule → [[P6 - Baseline Thresholds (locked)|Baseline Thresholds]]
- [x] **Hook/tray inventory — DONE 2026-07-30:** SessionStart→gstack, Stop→`praxis capture`, no PreCompact/SessionEnd, no PRAXIS tray running, Claude Code auto-memory ON. Instrumentation disclosed in [[P6 - Baseline Thresholds (locked)|Baseline Thresholds]].
- [x] **Notifications configured 2026-07-30** — `preferredNotifChannel`, `inputNeededNotifEnabled`, `remoteControlAtStartup`, and Windows Terminal `bellStyle`. Config verified; **delivery not yet tested** (see [[P6 - Baseline Thresholds (locked)|Baseline Thresholds]] for the 90-second three-layer test — needs a fresh session).
- [x] **Logging tool built 2026-07-31** — `log A glance waited 12 min...` from any terminal in `E:\agent-swarm`; `log` alone prints the tally. Built because a 5-minute rule fails if logging means opening an app and formatting a line by hand.
- [ ] **DAY 1 — do these two, in order:** (1) three-layer notification test in a **fresh session**, record what fired in [[P6 - Baseline Thresholds (locked)|Baseline Thresholds]]; (2) start logging.
- [ ] One evening: normal parallel workload under WSL — write the lag verdict (bug #41501: survived or died?)
- [ ] Five workdays on built-ins only — `log` as it happens
- [ ] Two teammate conversations — exact words + environment (OS, CC version, parallel usage)

## Packet B — Recall (three evenings)

- [x] **The audit (gated Recall M1) — DONE 2026-07-30:** verdict = **SEPARATE, siblings with shared organs.** PRAXIS = trust (proves, signs, judges — no search/QA ever). Recall = memory (extracts, searches, answers with provenance — never signs/judges). Shared organs → `recall-core` (transcript reader, redact, vault writer, commit join), extracted from PRAXIS as Recall M1 step 0. Full matrix in the Recall design doc.
- [x] **Signal-existence probe — DONE 2026-07-30:** 25 sessions, 532 error pivots, 90 LLM-classified windows. **Abandonment is a rounding error (1 unique event in 90 windows; 3.2% of pivots verbalized). GOTCHA is the hero card — 50% of all extractable cards, the only type that survives outside its own detector.** Overall yield 51%, demo-grade 37%. Regex inverts on negation → LLM judging mandatory. Full evidence: `Signal Probe Results` (Recall vault)
- [x] **Converger recon — DONE 2026-07-30 (capability audit; hands-on feel still yours to judge):** claude-mem is 89k stars and already has `decision`+`gotcha` in its schema — but no human search UI, no provenance, no git, no vault, and zero roadmap signal toward any of them. Claude Code Sync is negligible (0★, 215 downloads, no LLM); the real Obsidian incumbent is `claude-sessions` (turn-level deep links + BM25 + manual `/distill`). screenpipe is **not in this race** by its own docs. **Premise 2 is now literally false** — Repowise, Decispher, scribe, Bitloops all do some version of the refinery; Entire ($60M, ex-GitHub CEO) has the substrate, Unblocked ($20M A) has the answering layer. Defensible ground that survives: **provenance depth (commit SHA + transcript line) and ingest breadth (transcripts AND git)** — nobody credible does both. Full brief: `Converger Recon` (Recall vault)
- [ ] Name shortlist: three names that survive a GitHub/domain/trademark squint ("Recall" collides with Windows Recall)

## Verdict (fill at week's end)

- Winner of the build hours: ______
- Why (one paragraph, evidence only): ______
- Frozen project + unfreeze condition: winner's M1 demo lands

Plans of record: `~/.gstack/projects/agent-swarm/` (both design docs + CEO plans, all review-clean). Next machinery step: /plan-eng-review for the winner, with real inputs.
