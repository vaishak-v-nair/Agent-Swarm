---
type: index
project: Recall
updated: 2026-07-31
tags: [index, recall]
---

# Recall — Start Here

*Working name. Final name still to pick: **SHERD** · WHYBACK · CITEBOOK (all free on npm).*

**Answer with receipts.**

Knowledge no longer arrives as notes you write. It leaves as exhaust from work you already did — AI conversations, commits, sessions. Recall refines that exhaust into cards you can question, and every answer cites the exact transcript line and the exact commit where it happened.

It beats **re-asking the model**, not note-taking. A fresh model can guess again. It cannot show you where you decided.

**Status:** design approved (9/10 after two adversarial rounds), scope review clean. **Not built.** Competing with AgentSwarm for the same build hours this week.

## The vault

| Folder | What's in it |
|---|---|
| `01 Identity` | What this is, every decision with its date, what Claude remembers between sessions |
| `02 Research` | The two measurements that reshaped the product |
| `03 Plans` | The claim, the gates, the milestones |
| `05 Sessions` | How it was decided — currently held in the AgentSwarm vault, since both products came out of the same conversations |

## Read in this order

1. [[Recall - Home]] — what it is, and its boundary with PRAXIS
2. [[P1 - The Claim|The Claim]] — disproven twice, and what survived
3. [[R1 - Signal Probe Results|Signal Probe Results]] — the measurement that replaced the demo
4. [[R2 - Converger Recon|Converger Recon]] — who else is here, and what they cannot do
5. [[P2 - Gates|Gates]] — what must be true before a line is written

## The two findings that matter most

**The hero card was wrong.** The demo was built on recovering approaches abandoned mid-session. Measuring 25 real sessions found 1 such event in 90 windows — abandonment is almost never written down. **Gotchas** replaced it: half of everything extractable, and the only card type that surfaced from detectors built to find something else.

**The claim died twice.** "Nobody ingests work exhaust" — false. "Nobody refines it for humans" — also false. What survives is narrower and checkable: **cited to the exact line and the exact commit, from both transcripts and git.** Nobody credible does both.

## Related

- **AgentSwarm** — separate product, vault at `E:\agent-swarm\AgentSwarm intelligence`
- **PRAXIS** — shipped, at `E:\PRAXIS`. Sibling, not duplicate: PRAXIS proves what the AI did; Recall remembers why.
- Mirrored into the global archive at `E:\Second Brain`.
