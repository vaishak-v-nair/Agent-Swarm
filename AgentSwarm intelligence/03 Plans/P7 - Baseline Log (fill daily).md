---
tags: [tournament, baseline, log]
started: 2026-08-01
ends: 2026-08-07
---

# Baseline Week — the log

**Started 2026-08-01.** Five workdays. Log within **5 minutes** of noticing.
Thresholds are locked in [[P6 - Baseline Thresholds (locked)|Baseline Thresholds]] — do not adjust them mid-week.

> ### What changed about this week
>
> This log was designed to answer *"is the pain real enough to justify building
> AgentSwarm"*, with a STOP gate if it wasn't. **M1–M4 are already built**, so that
> gate has been overtaken — it can no longer stop anything.
>
> The dimensions are still exactly right, so the week runs unchanged with one
> addition: every entry now records **which surface** it happened on. AgentSwarm
> sets `AGENTSWARM` in each pane, so `log` fills that in by itself — nothing extra
> to remember.
>
> The question is now: **is the pain smaller in here than in the plain CLI?**
> A week that logs plenty of A/C/R incidents *inside AgentSwarm* is not a success
> for the app. It is the most useful result available, and the one thing no amount
> of further building can produce.
>
> This also runs M1's unrun exit test — *"it is my daily driver and I do not
> switch back"* — for the first time.

## Log with one command

From any terminal, in `E:\agent-swarm`:

```
log A glance   waited ~12 min on a permission prompt, didn't notice
log C          had to scroll back to see what the auth session actually did
log R          three diffs piled up, couldn't tell which needed me first
log lag        typing stuttered badly in the third terminal
```

`log` on its own shows today's entries and the running tally. `log tally` shows the whole week against the thresholds.

The tag is the only thing you must get right:

- **A** — attention: a session waited ≥5 min and you didn't notice. Add how you eventually noticed (`glance`, `toast`, `timer`, `phone`, `tray`) — that word is what separates *blocked* from *blocked-unnoticed*, which is the number T-A actually turns on.
- **C** — comprehension: you knew it finished but still had to scroll or re-read to understand what it did.
- **R** — review: diff triage, which-session-touched-what, merge conflicts.
- **lag** — the Windows CLI lag bug. Logged for the record, **excluded from every count**.

Not every annoyance is an incident. If it doesn't fit, write it under Loose observations by hand — that's where surprises live, and surprises have been the most valuable thing in this project so far.

---

## Entries

<!-- entries -->



---

## Loose observations
*Anything that doesn't fit a dimension. Especially: moments where Claude Code's built-in auto-memory helped or failed you — that's live competitive evidence for the kill conditions.*

- 

---

## Lag verdict — the WSL evening (premise 2)

- Date tested:
- Sessions run in parallel:
- Verdict: **LAG SURVIVED IN WSL** / **LAG GONE IN WSL**
- Notes:
- *(Either way this gates nothing. If it survived, file the upstream issue — lag is out of product scope by the no-performance-claims guardrail.)*

## Teammate evidence (assignment item 3)

**Teammate 1**
- Name / role:
- Environment: OS ____ · Claude Code version ____ · runs parallel sessions? Y/N
- Exact words to *"what happened the last time you ran Claude in another terminal?"*:

**Teammate 2**
- Name / role:
- Environment: OS ____ · Claude Code version ____ · runs parallel sessions? Y/N
- Exact words:

*Platform rule: if both are non-Windows, Stage 1a stays personal-scope and G-ADOPT re-scopes to the first surface they can actually run.*

## Week tally (fill on day 5, BEFORE re-reading the gates)

| Dimension | Count | Threshold | Pass? |
|---|---|---|---|
| A — attention | | ≥2 | |
| C — comprehension | | ≥3 | |
| R — review | | ≥3 | |
| lag (excluded) | | — | — |

**Notification layers that actually fired during the week** (from the pre-flight test): taskbar ___ · sound ___ · phone ___

**If A, C, and R all fail → STOP.** Write the closure note, build nothing, archive. That is a real and honorable outcome: five days spent to avoid two months of building the wrong thing.
