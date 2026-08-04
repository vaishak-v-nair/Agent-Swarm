---
milestone: M12
date: 2026-08-01
commit: 1ce4b46
status: shipped
---

# B12 — M12: The Semantic Layer Stops Assuming Claude Code

M11 let a pane run any command. But the semantic layer still computed Claude
Code's transcript path itself, and the frontend still checked
`profile === 'claude'` before attaching — so the headline feature worked for
exactly one vendor.

This is the first of the three things [[R2 - QM Read In Full|worth stealing from QM]]: their harness contract declares capabilities and the core degrades where a
harness cannot answer.

## A profile declares its own source

```json
"profiles": {
  "mine": {
    "command": "some-agent",
    "transcript": { "dir": "{cwd}/.sessions", "format": "claude-jsonl" }
  }
}
```

`{home}` · `{cwd}` · `{cwd_slug}` are substituted. An unrecognised placeholder is
treated as a typo, not as a literal directory name.

## The test that is the actual point

Claude's own location is now expressed through the same mechanism:

```rust
pub const CLAUDE_DIR: &str = "{home}/.claude/projects/{cwd_slug}";
```

and a test asserts `project_dir(cwd) == resolve_dir(CLAUDE_DIR, cwd)`.

> If the built-in case did not go through the general mechanism, a second agent
> would be a second special case rather than a second configuration.

That is the only honest way to know an abstraction fits — make the thing it was
extracted from use it.

## What it refuses to do

Only `claude-jsonl` is parsed. A profile declaring any other format is accepted,
recorded, and reported as unreadable.

**A wrong reading of somebody's session is worse than no reading.** This is the
layer that must never invent, and pretending to parse a format nobody has seen
would be exactly that.

## Verified

Two non-Claude profiles, both running `node`:

```
pane 1 (reads-claude) transcript: catching up on 7e015ca2….jsonl
pane 1 semantic layer live
pane 2 (no-reader)    transcript: no reader for codex-rollout sessions
```

The first is **a pane that is not Claude Code receiving the full semantic
layer**. The second is the honest degradation.

30 Rust tests · 26 JS tests.

## What this does not do

- **No second format is implemented.** The plumbing is general; the reader is
  not. Adding one means reading a real Codex or OpenCode session file, which
  nobody has done.
- `search` and `touched_by` still assume Claude's directory. The *watcher* is
  adapter-driven; historical search is not.
- Nothing was done for speed or polish this milestone. Both were asked for and
  both were left; see below.

## Where this leaves the project

Twelve milestones. AgentSwarm's central claim — *the terminal built for agentic
coding* — is now true of the architecture and not only of the README.

The [[P7 - Baseline Log (fill daily)|baseline week]] started 2026-08-01 and is
still empty.

See [[R2 - QM Read In Full]] · [[B11 - M11 Any Agent]] · [[P4 - Milestones]]
