---
milestone: M11
date: 2026-08-01
commit: 31441e6
status: shipped
---

# B11 — M11: Any Agent, Not Just Claude Code

Prompted by YC open-sourcing [[R1 - QM and What It Means For Us|QM]] — a
multi-agent harness where, reportedly, *"Pi, OpenCode, Codex and Claude Code all
drive the same core, so a deployment isn't tied to any single vendor."*

## The assumption it exposed

This binary knew five commands: `powershell`, `cmd`, `pwsh`, `wsl`, `claude`.
Anything else was unreachable.

That quietly asserted **a pane runs Claude Code**. Which was never the thesis —
the cockpit is about running several agents at once, and it should not care which
agent. QM did not create that limitation; it made it impossible to keep ignoring.

## Profiles you define

```json
"profiles": {
  "qm":    { "command": "qm", "args": ["run"] },
  "codex": { "command": "codex", "keep_open": false }
}
```

- A defined profile **shadows a built-in of the same name**, so a settings file
  can correct anything this binary got wrong about a command.
- `keep_open` defaults to true — the pane outlives the agent, the way `claude`
  already behaved, so quitting and restarting an agent does not cost the pane.
- The **command itself is quoted**, not only its arguments. A command name out of
  a settings file gets the same treatment as a recipe argument: quoted, inert,
  never script. Tested with `"qm; rm -rf /"` as a command name.
- `available_profiles` now takes the folder, since custom profiles live in that
  folder's settings — and still only offers commands this machine can run, since
  a menu listing what is not installed is a menu that lies.

That last point required fixing the boot order: `cwd` is now resolved *before*
profiles are asked for, which it was not.

## Verified

A pane launched from a user-defined profile:

```
powershell -NoLogo -NoExit -Command "& 'node' '--version' '--eval' 'console.log(1)'"
```

Everything else already works for a non-Claude pane: the terminal, the state
machine (which reads the bell and throughput, not the transcript), stage, the
timeline, changes. **Only the semantic layer stays Claude-specific**, because it
reads Claude Code's JSONL — and it degrades by saying so rather than by breaking.

28 Rust tests · 26 JS tests.

## On adopting QM itself

Not done, and it should not be pretended otherwise. Nobody has read the repo.
x.com returned 402 to the fetcher, so even the quote above is secondhand from
search coverage. [[R1 - QM and What It Means For Us]] records what is known and
what is not.

The profile was cheap and correct regardless of what QM turns out to be. Actually
adopting it is a real decision that should follow reading the code.

## Where this leaves the project

Eleven milestones. AgentSwarm is no longer a Claude Code terminal — it is a
terminal for agents, which is what it should have been from M1.

The [[P7 - Baseline Log (fill daily)|baseline week]] started 2026-08-01 and is
still empty.

See [[B10 - M10 Stage]] · [[R1 - QM and What It Means For Us]] · [[P4 - Milestones]]
