# AgentSwarm — Architectural Decision Records (ADRs)

> **Notice to AI Agents**: This file documents immutable design invariants and architectural choices. Do not reverse or violate these decisions without explicit justification and user confirmation.

---

## ADR-001: PTY Interaction Truth vs Semantic Understanding Truth

### Context
Terminal emulators often try to intercept and rewrite terminal streams, replacing them with chat widgets or pseudo-terminal representations. This breaks ANSI escape codes, terminal multiplexers, vim/nano, cursor addressing, and tool outputs.

### Decision
- The **ConPTY terminal is the ground truth of interaction**. Bytes from the subprocess flow directly to xterm.js; user typing flows directly to the PTY.
- The **Semantic Layer is strictly additive**. Transcripts from disk and SQLite events provide plain-English cards and timeline views, but never swallow, modify, or block raw PTY bytes.
- If the semantic layer fails to attach or corrupts, the terminal remains 100% operational.

---

## ADR-002: Strict Zero-Mock & Grounding Policy

### Context
Early iterations of test harnesses and dev bridges contained hardcoded fake paths (e.g. `/home/user/project`) and synthetic mock session cards. This created false confidence while breaking real-world user runs.

### Decision
- **No fake data in production paths or test harnesses.**
- Every status, attention score, and timeline item MUST originate from real SQLite rows, real disk transcript files, or real PTY output.
- In test environments, tests must assert against actual schema properties and deterministic IPC contracts.

---

## ADR-003: Attention Scoring & Exponential Time Decay

### Context
When running 6–10 parallel agents, developers experience alert fatigue if notifications fire continuously, or miss critical blocks if notifications fire only once.

### Decision
- Calculate an integer attention score $\in [0, 100]$:
  - **PTY Bell (`\x07`)**: $+50$ pts (agent explicitly asking for human input).
  - **Crash / Error Exit**: $+45$ pts (agent process terminated unexpectedly).
  - **Permission Prompt**: $+40$ pts (agent waiting for tool approval).
  - **Waiting on Human Prompt**: $+20$ pts (agent completed turn and waiting for prompt).
- **Time Decay**: Apply exponential decay with a half-life of $\tau = 45\text{s}$:
  $$\text{Score}(t) = \text{Base} \times 2^{-\Delta t / \tau}$$
  This ensures unattended requests slowly settle in priority rather than permanently screaming at the developer.
- Attention levels:
  - Score $\ge 50 \implies$ `urgent` (red chip, glowing beacon, high chime).
  - Score $\ge 25 \implies$ `action_needed` (amber chip, chime).
  - Score $< 25 \implies$ `nominal` / `working` / `idle`.

---

## ADR-004: Windows ConPTY Concurrency & Terminal Safety

### Context
On Windows, ConPTY process creation can data-race with environment mutations (`std::env::set_var`). Furthermore, rapid window resizing during layout transitions causes WebGL context loss or degenerative $1 \times 1$ terminal fits.

### Decision
- Any code or test mutating `std::env` MUST acquire the global `pty::ENV_LOCK` mutex.
- Terminal resize events must be debounced (60ms) and reject degenerate dimensions ($< 2 \times 2$).
- Panes must be re-parented at most once per layout change to prevent WebView2 canvas destruction.

---

## ADR-005: Multi-Modal Synthesized Audio Cues

### Context
Relying on external `.mp3` or `.wav` sound files introduces disk I/O latency, missing asset runtime errors, and platform path discrepancies.

### Decision
- Use the **Web Audio API** to procedurally synthesize pleasant two-tone chimes ($D_5 \to A_5$, 587 Hz to 880 Hz) using a sine oscillator and exponential gain ramp ($< 400\text{ms}$).
- Silent fallback: If the browser audio context is suspended or running headless in automated tests, audio operations silently catch errors without interrupting execution.

---

## ADR-006: 1-Click Human-in-the-Loop (HITL) Keystroke Injection

### Context
Switching focus to an agent pane, reading the prompt, typing `y`, and pressing <kbd>Enter</kbd> takes 5–10 seconds per approval. Across 20 approvals an hour, this creates significant friction.

### Decision
- Inline `.pane-action-banner` elements provide 1-click buttons:
  - `Approve (y)`: Injects `y\r` directly into the pane's ConPTY.
  - `Reject (n)`: Injects `n\r` directly into the pane's ConPTY.
  - `Restart`: Safely kills the dead process and respawns a fresh session in the same slot.
- All keystrokes dispatched through 1-click buttons clear the attention alarm and unseen state immediately.
