---
tags: [research, competitive]
date: 2026-08-01
source: https://x.com/ycombinator/status/2083243960684908768
---

# R1 — QM, and what it means for us

## What it is

YC open-sourced **QM**, a multi-agent harness they use internally. In their own
words:

> "We've decided to open-source a multi-agent harness we use internally at YC.
> We call it 'QM' and it's meant to be easy to customize, like Hermes or
> OpenClaw, but useful for a whole company… MIT license. It is cloud-first and
> has Slack and web UI natively."

Repo: [yc-software/qm](https://github.com/yc-software/qm) ·
site: [qm.ycombinator.com](https://qm.ycombinator.com/)

Reported features: triggers (crons, webhooks), memory, shared files, connectors,
agent browser support, shareable web artifacts, multiplayer projects, per-person
isolated workspaces. Used across accounting, legal, events and engineering.

> **Read this note with a caveat.** x.com returned HTTP 402 to the fetcher, so
> the quote and the feature list come from search results and coverage, **not**
> from the post or the repo directly. Nobody has read the QM source. Treat every
> claim here as secondhand until someone opens the repository.

## The line that matters

> QM lets you pick your own harness and model and switch between them — Pi,
> OpenCode, Codex and Claude Code all drive the same core, so a deployment isn't
> tied to any single vendor.

## Is it a competitor?

**No — a different layer.** They compose rather than collide.

| | QM | AgentSwarm |
|---|---|---|
| where it runs | cloud-first | local desktop |
| surface | Slack, web UI | a terminal |
| scope | a whole company, many people | one person, many sessions |
| unit | an agent doing a task | a pane you can type into |

QM orchestrates agents across an organisation. AgentSwarm is where one person
sits while several agents work. A QM agent could reasonably run *inside* an
AgentSwarm pane.

## What it changed here

It exposed an assumption. AgentSwarm knew five commands and nothing else, which
quietly asserted that a pane runs Claude Code. QM's whole premise is that the
harness is swappable — and once that is said out loud, a cockpit hard-wired to
one vendor is obviously the weaker design.

[[B11 - M11 Any Agent|M11]] made profiles definable. `qm` is now a profile you
can add in one line, and everything except the semantic layer works for it.

## What has not been done

- **Nobody has run QM.** Adding a profile makes it *possible* to try; that is not
  evidence it is worth trying.
- The repo has not been read. Cloud-first with a Slack UI may or may not suit a
  solo builder on Windows.
- Whether QM overlaps with [[Recall]] — memory, connectors, a "company brain" —
  is unexamined, and is the most interesting open question, because Recall's
  whole pitch is *answer with receipts*.

## The honest recommendation

Adding the profile was cheap and correct regardless of what QM turns out to be.
**Actually adopting it is a real decision and should follow reading the code, not
a tweet.** If it is wanted, the next step is an hour with the repository and a
note here saying what it does and does not do.

See [[B11 - M11 Any Agent]] · [[P4 - Milestones]]
