# AgentSwarm Agent Protocol Rule

Every time a conversation or task starts in this workspace, you MUST execute the following sequence BEFORE doing any research or modifying code:

1. **Read Core Context**:
   - Inspect `AGENTS.md` at workspace root.
   - Inspect `PROJECT_STATUS.md` at workspace root for current state and test health.
   - Inspect `DECISIONS.md` at workspace root to ensure no invariants are violated.

2. **Log the Session**:
   - Open `SESSION_LOG.md`.
   - Append a new session entry using the template provided in `SESSION_LOG.md` with:
     - Timestamp
     - User request / objective
     - Initial plan

3. **Engineering Invariants**:
   - Interaction truth = ConPTY; Understanding truth = Semantic layer / SQLite events.
   - Zero synthetic mocks or fake data in production or dev harness.
   - Never report completion without running and passing `cargo test` in `app/src-tauri` and `npm test` in `app`.

4. **Session Finalization**:
   - Update `PROJECT_STATUS.md` with what changed.
   - Complete the session entry in `SESSION_LOG.md` with verification proof and handoff state.
