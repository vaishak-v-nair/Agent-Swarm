---
tags: [concept, feature]
---

# The Toggle

The signature feature — survived from the very first pitch ("toggle option where a user wants to see the execution / only the plain-english texts").

**One keystroke flips a pane between:**

- **Raw view** — the authentic live terminal (real PTY, full fidelity), and
- **Semantic view** — a foldable timeline of the *same live session*: tool calls as collapsible cards, diffs rendered as diffs, plain-English narration per block.

## Why it's new

Everyone else either shows raw terminals or replaces the terminal with chat. Nobody renders *understanding over the live terminal session*. The trick that makes it honest: the semantic view renders from Claude Code's **structured JSONL transcript**, never from scraping ANSI screen output — see [[P3 - Architecture|Architecture]].

## Rules

- The Toggle is a lens, not a mode: both views are always live, always the same session.
- Transcript format drifts (undocumented) → semantic view degrades gracefully to raw; the terminal never breaks. Fixture-tested parser, version-pinned ([[R2 - Claude Code Internals|Claude Code Internals]]).
