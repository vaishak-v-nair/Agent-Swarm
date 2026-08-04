---
name: verified-loop
description: AgentSwarm's verification machinery — smoke, doctor, demo, record — and the rule that "verified" requires npm run verified
metadata:
  type: project
---

AgentSwarm has a verification loop built after five user-found bugs shipped in
"verified" code: `npm run verified` = JS tests + Rust tests + `scripts/smoke.ps1`
driving the real binary. `agentswarm --doctor` self-checks (every failure prints
its fix). `npm run record` films the app driving its own UI via `--demo` —
zero OS input, because focus belongs to the user.

**Why:** unit tests and the harness both passed while the launch command didn't
exist and the window froze. Only starting the real binary catches that class.

**How to apply:** never write "verified" in a commit for this repo without
`npm run verified` passing. Design problems: look at a `record` frame first.

Related: [[drive-the-ui-before-shipping]] · [[agent-swarm-design]]
