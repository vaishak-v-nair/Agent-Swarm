---
type: identity
project: AgentSwarm
updated: 2026-07-31
tags: [principles]
---

# Working Principles

Rules that came out of the work, not from a template. Each one was learned the expensive way.

## On evidence

**Numbers get written down before the data exists.** The three thresholds for the evidence week were locked on 2026-07-30, before day one. Not because the numbers are perfect, but because a threshold chosen after seeing the data is not a threshold — it is a rationalisation.

**Stop is a real answer.** If all three gates fail, the correct outcome is: write the closure note, build nothing, archive. Five days spent avoiding two months of wrong work is a win.

**Measure the real setup, not a clean one.** This machine runs other tooling. Rather than pretend otherwise, the instrumentation is disclosed in the log header. The honest question is "does my actual setup solve this," not "would a laboratory setup solve this."

## On claims

**A claim that dies twice can still be worth keeping — if each rewrite makes it narrower and truer.** Recall's differentiation claim was disproven twice by named competitors. The third version is smaller and checkable.

**Check the competitor's citation format, not their marketing.** The whole AI-memory field claims to cite sources. Reading what they actually return — a file path, a channel name, a time window, or nothing — is where the real gap was found.

## On building

**Do not race the vendor.** When Anthropic shipped session ownership, that scope was retired rather than rebuilt. What survives is what the vendor's own docs say it cannot do.

**Verify the signal exists before building the extractor.** A demo was designed around "recovering approaches you abandoned." Measuring real transcripts showed abandonment is almost never written down. The demo changed. The build did not waste three weeks finding out.

**Test what the promise is, not what the code is.** A parser test proves a line was read. Only an end-to-end test proves "a waiting session produces an alert within 60 seconds."

## On process

**The complete version is usually the right call, but it must carry insurance.** Every large choice here has been the ambitious one. So plans carry gates, thresholds, and named kill conditions — the ambition gets tested rather than trusted.

**A tool that can fail silently is a contradiction when the tool's job is to prevent silent failure.** Hence: a watchdog on the watcher, and visible degradation everywhere.

**Do not let one advisor drive every decision.** Independent cold reads found a formal deadlock in the gate logic and a hole in the signal model that the main analysis missed entirely.

Related: [[Decision Log]] · [[00 Start Here]]
