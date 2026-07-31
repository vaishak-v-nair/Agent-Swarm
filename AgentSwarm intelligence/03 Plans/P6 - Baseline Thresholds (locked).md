---
tags: [tournament, gates, pre-registered]
locked: 2026-07-30
---

# Pre-Registered Thresholds — LOCKED before baseline day 1

*The whole point of pre-registration: these numbers were fixed BEFORE the data existed, so the gates decide instead of rationalize. Do not edit these after logging starts. If they turn out wrong, note that in the verdict — don't move the goalposts.*

**Locked:** 2026-07-30, before any baseline day.

## The three dimension gates (per 5 workdays)

| Gate | Threshold | Counts an incident when… |
|---|---|---|
| **T-A — attention** | **≥ 2** | a session sat waiting ≥5 minutes and you didn't notice, *despite* built-in notifications being configured and on |
| **T-C — comprehension** | **≥ 3** | you knew a session had finished/moved but still had to scroll or re-read to understand what it actually did ("notification fired but I had to scroll to understand") |
| **T-R — review** | **≥ 3** | review backlog bit: diff-triage delay, "which session touched what" confusion, or a parallel-edit merge conflict |

**Logging discipline:** each incident logged **within 5 minutes** of noticing. A late log is not an incident — memory reconstructs, and reconstruction is what pre-registration exists to defeat.

**Exclusion rule:** entries caused by the Windows CLI lag bug (claude-code#41501) are **tagged `lag` and excluded from all three counts.** The lag verdict gates nothing in either direction.

## What each outcome unlocks

- **T-A passes** → Stage 1a (the tray nagger) is authorized.
- **T-C passes** → digests / narration authorized (this is the premise-3 test).
- **T-R passes** → the review lane authorized.
- **T-C or T-R passes** → the shared substrate (parser, board, auth, watchdog, bounds) is authorized — built once, never captive behind one dimension.
- **All three fail** → **STOP.** Write the closure note ("built-ins + WSL sufficient"), build nothing, archive. Re-entry only via a fresh 5-day baseline.

## Pre-baseline configuration (do this BEFORE day 1)

- [x] **`preferredNotifChannel` → `terminal_bell`** (set 2026-07-30; was UNSET). Chosen over `auto` because the alternatives in the schema are iTerm2/kitty/ghostty channels that do nothing on Windows Terminal, and a measurement week wants an explicit, reproducible channel.
- [x] **`inputNeededNotifEnabled` → `true`** (set 2026-07-30) — mobile push when a permission prompt or question is waiting.
- [x] **Windows Terminal `bellStyle` → `["audible","window","taskbar"]`** (set 2026-07-30 in `profiles.defaults`; was unset = audible only). Applies to all 12 profiles. Backup at `settings.json.praxis-backup-20260730`. Now a waiting session rings, flashes the window, AND flashes the taskbar — visible from another app, which is the case the week actually measures.
- [x] **`remoteControlAtStartup` → `true`** (set 2026-07-30, builder's explicit call) — opens the claude.ai bridge each session so input-needed push can reach the phone. Deliberately NOT enabled: `autoUploadSessions` (would mirror every session) and `agentPushNotifEnabled` (proactive pushes). Sessions are reachable while running; they are not archived to claude.ai.
- [ ] **Verify before day 1 — three layers, ~90 seconds. Config was verified 2026-07-30; DELIVERY was not and cannot be verified by tooling (agent shells run detached from the TTY).**
  1. **Bell path, no Claude involved.** In a Windows Terminal tab type `printf '\a'` (bash) or ``Write-Host "`a"`` (PowerShell) and press enter. Expect: sound + window flash + taskbar flash. If nothing happens, the `bellStyle` edit didn't take and everything above it is moot.
  2. **Claude Code needs-input bell.** Start a **fresh session** (required — see below), ask for something needing approval, alt-tab away before it prompts. Expect the taskbar to flash while you're in another window.
  3. **Mobile push.** Same fresh session, same prompt — check the phone.
  - Record which layers fired: ______ (this IS the counterfactual the week measures against)
- ⚠️ **`remoteControlAtStartup` applies at SESSION START.** Verified 2026-07-30: no bridge was running in the session where it was set (the only listening node processes were `serve.mjs` and the gstack browse daemon). **Mobile push cannot work until a new session is started.** Start day 1 in a fresh session.
- [x] Hook/tray inventory recorded (below) — 2026-07-30.

**Baseline honesty note:** whichever of these ends up enabled *is* the counterfactual. If mobile push works, it is the closest thing the vendor ships to Stage 1a's whole premise — and a week of it working would be strong evidence against building 1a at all. That is a result worth wanting.

## Instrumentation disclosure (the machine is not clean, and that's fine)

The honest counterfactual is "my real setup + built-ins," so this is disclosed rather than removed:

**Global** (`~/.claude/settings.json`):
- `SessionStart` → `gstack-session-update` (gstack skill infrastructure)
- `Stop` → `praxis capture` (writes `.praxis/memory.md`, seals a receipt, mirrors to this vault)
- Notification stack under test: `terminal_bell` + `inputNeededNotifEnabled` + `remoteControlAtStartup`
- **Claude Code auto-memory is ON** (`autoMemoryEnabled` unset = default on). This is the kill-condition incumbent running live on this machine — when it helps or fails during the baseline, log it. That observation is competitive evidence.

**Project** (`E:\agent-swarm\.claude\settings.local.json`, added 2026-07-30 by `praxis init`):
- `PreCompact` → capture (snapshot before compaction)
- `SessionStart` → PRAXIS tray
- The duplicate project-level `Stop` hook that `init` wrote was **removed** — the global one already captures, and two would double-fire. See [[How Sessions Are Captured]].

**Terminal:** Windows Terminal `bellStyle` = `["audible","window","taskbar"]` across all 12 profiles.

*Changed since this note was first written: bellStyle set, project settings created, PRAXIS tray now running (previously only `vgtray`). The baseline measures this stack, not a clean machine.*

Related: [[P5 - Tournament Week|Tournament Week]] · [[P7 - Baseline Log (fill daily)|the baseline log]] · `Converger Recon` (Recall vault)
