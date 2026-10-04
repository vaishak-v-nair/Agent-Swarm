# AgentSwarm — Workspace Agent Protocol & Operating Rules

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS (Antigravity, Claude Code, Cursor, Codex, etc.)**:
> Every time a conversation or task starts in this workspace, you **MUST** follow the protocol below **BEFORE** taking any action, researching, or modifying code.

---

## 1. Mandatory Pre-Flight Protocol (Every Session)

Whenever you begin a conversation or receive a new task:

1. **Read Core Context**:
   - Check `PROJECT_STATUS.md` for the active codebase state, recent changes, and current roadmap.
   - Check `DECISIONS.md` to ensure your proposed changes do not violate architectural invariants.
   - Check `DESIGN.md` (if dealing with UI/UX) for the Cyber-Minimalist style tokens and guidelines.
2. **Update the Session Ledger**:
   - Open `SESSION_LOG.md`.
   - Append a new session block with:
     - Current timestamp
     - User request / objective
     - Pre-flight status (verified clean git state, test baseline)
3. **Understand Before Modifying**:
   - Never write code before locating the real implementation path.
   - Check existing abstractions before inventing new ones.
4. **Post-Task Finalization**:
   - Before reporting completion to the user:
     - Run both test suites: `cargo test` in `app/src-tauri` and `npm test` in `app`.
     - Update `PROJECT_STATUS.md` with what changed and current verification status.
     - Finalize the active session record in `SESSION_LOG.md`.

---

## 2. Core Architectural Philosophy

AgentSwarm is built around a single unifying principle:

> **A real terminal underneath, with an intelligence layer above it.**

1. **The PTY represents interaction truth**:
   - The terminal must never be replaced by a fake UI, mock stream, or abstracted chat shell.
   - Direct keystrokes and raw output flow through Windows ConPTY without intermediary buffering.
2. **The semantic layer represents understanding truth**:
   - The transcript watcher, SQLite event store, and attention engine read real disk transcripts and PTY events.
   - AgentSwarm must **never** pretend to know something that its underlying evidence cannot establish.
3. **Additivity**:
   - The intelligence layer is strictly additive. If transcripts fail to correlate or the database is uninitialized, the terminal underneath remains 100% responsive and functional.

---

## 3. Strict Engineering Invariants

### Invariant 1: Zero-Mock / Grounding
- **Never inject synthetic or hardcoded fallback data into production paths or test harnesses.**
- When running in dev/harness mode, use the real backend bridge (`/api/bridge`) or real ConPTY IPC.
- If data is unavailable, surface that condition honestly (e.g. `"watching for a session…"`).

### Invariant 2: Windows ConPTY Safety
- Modifying `std::env` in tests or runtime can race with ConPTY process creation.
- **Rule**: All test code modifying environment variables MUST acquire `pty::ENV_LOCK`.
- Pane resizing MUST debounce PTY calls and avoid degenerate dimensions ($< 2 \times 2$).

### Invariant 3: UI Architecture (V2)
- **Do not use `innerHTML` on the entire grid or board.**
- V2 uses a 4-zone shell (`sidebar`, `main-workspace`, `context-inspector`, `terminal-drawer`).
- Components should subscribe to the central `workspace` state store (in `workspace.js`) and re-render granularly.

### Invariant 4: Verification Standard
- No change is complete without passing:
  1. `cargo test` in `app/src-tauri` (48+ unit tests).
  2. `npm test` in `app` (43+ Node.js tests).
- If tests fail, diagnose the root cause immediately—never weaken assertions or mask errors.

---

## 5. Summary Checklist for Every Turn

- [ ] Looked at `PROJECT_STATUS.md` and `DECISIONS.md`.
- [ ] Updated `SESSION_LOG.md` with session start.
- [ ] Kept terminal truth intact (no synthetic fallbacks).
- [ ] Cleaned up AI slop or boilerplate when refactoring.
- [ ] Followed DESIGN.md for styling changes.
- [ ] Ran `cargo test` and `npm test` after code changes.
- [ ] Updated `PROJECT_STATUS.md` and finalized `SESSION_LOG.md` before finishing.
