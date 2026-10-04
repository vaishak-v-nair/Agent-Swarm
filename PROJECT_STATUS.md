# AgentSwarm — Living Project Status

> **Notice to AI Agents**: This file is the single source of operational truth for project state. Review this file at the start of each session and update it before concluding.

**Last Updated**: 2026-10-04  
**Current Git Branch**: `main` (tracked to `origin/main`: `https://github.com/vaishak-v-nair/Agent-Swarm.git`)  
**Test Suite Health**: **100 / 100 Tests Passing (100% Green)**  
- Rust backend: 54 passed, 0 failed (`cargo test`)
- Frontend/Node: 46 passed, 0 failed (`npm test`)

---

## 1. System Architecture Snapshot

AgentSwarm is a native desktop workspace for every AI coding agent (Claude Code, OpenAI Codex, Gemini CLI, Copilot CLI, OpenCode, Aider, PowerShell).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AgentSwarm V2 Desktop Shell                            │
├────────────────────┬───────────────────────────────────────┬───────────────────────────┤
│    LEFT SIDEBAR    │            MAIN WORKSPACE             │  RIGHT CONTEXT INSPECTOR  │
│  [Project Select]  │  ┌─────────────────────────────────┐  │  • Active Project / Repo  │
│  + New Agent Task  │  │  Home Dashboard or Session View │  │  • Git Branch & Worktree  │
│  • Home Workspace  │  │  ┌───────────────────────────┐  │  │  • Verification Status    │
│  • Working Changes │  │  │ Session Inception Card    │  │  │  • Working Tree Diffs     │
│  • Unified Timeline│  │  │ Task Prompt, Agent Badge, │  │  │  • Attention Provenance   │
│                    │  │  │ ConPTY Pane, Status Pulse │  │  │                           │
│  AGENT SESSIONS    │  │  └───────────────────────────┘  │  │                           │
│  • #1 Claude Code  │  │  [Conversation] [Changes]       │  │                           │
│  • #2 Codex        │  │  [Verification] [Raw Terminal]  │  │                           │
│  • #3 Gemini CLI   │  └─────────────────────────────────┘  │                           │
├────────────────────┴───────────────────────────────────────┴───────────────────────────┤
│            COLLAPSIBLE BOTTOM EXECUTION DRAWER (Real ConPTY xterm.js Terminals)        │
│  [Agent #1] [Agent #2] [Shell #3] [+]                      Show Terminal ⌄ (`)         │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                            Tauri IPC / ConPTY
                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Rust Backend Core (Tauri v2)                              │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │ Project Registry       │  │ Agent Adapter Registry │  │ Agent Session Manager    │  │
│  │ (project.rs)           │  │ (Claude, Codex, etc.)  │  │ (session.rs)             │  │
│  └───────────┬────────────┘  └───────────┬────────────┘  └────────────┬─────────────┘  │
│              │                           │                            │                │
│              ▼                           ▼                            ▼                │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │ Windows ConPTY Subproc │  │ SQLite Event Store     │  │ Attention Engine         │  │
│  │ (pty.rs)               │  │ (store.rs)             │  │ (attention.rs)           │  │
│  └────────────────────────┘  └────────────────────────┘  └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Completed Milestones & Capabilities

| Milestone / Feature | Status | Description |
|---|---|---|
| **V2: Workspace Redesign** | Complete | "One desktop workspace for every AI coding agent" with 4-zone shell, vendor-neutral adapters, Home dashboard, and session views. |
| **V2: Session Inception** | Complete | Replaces empty black rectangles with rich task metadata, pulse heartbeat, and immediate tab navigation. |
| **V2: Bottom Terminal Drawer** | Complete | Collapsible execution drawer (`~` / `` ` ``) guaranteeing interaction truth with real ConPTY streams. |
| **V2: Project Model & Registry** | Complete | First-class projects with repository path, branch tracking, and default verification runner. |
| **V2: Multi-Agent Adapters** | Complete | First-class adapters for Claude, Codex, Gemini, Copilot, OpenCode, Aider, and native shells. |
| **V2: Verification Engine** | Complete | First-class verification suites separating agent completion from verified correctness. |
| **M1: Core Terminal** | Complete | Windows ConPTY terminal hosting via xterm.js & Tauri v2. |
| **M2: Semantic Watcher** | Complete | Background JSONL transcript stream correlation for Claude Code sessions. |
| **M3: State Machine & Peeks** | Complete | Real-time burst detection, idle vs busy heuristics, meaningful line peek extraction. |
| **M4: Command Palette & Timeline** | Complete | Merged chronological timeline (`ctrl+shift+M`) and fuzzy search palette (`ctrl+shift+P`). |
| **M5: Diffs & History** | Complete | In-memory git change inspector (`ctrl+shift+D`) and scrollback search (`ctrl+shift+S`). |
| **M6: First-Run Recipes** | Complete | Swarm recipe authoring, seeding starter swarms, and `--swarm <name>` launcher. |
| **M7: Layout Restoration** | Complete | Persistent session layout save/restore across app restarts (`.agentswarm/last-layout.json`). |
| **M8: Zero-State Onboarding** | Complete | Clear empty layout instructions and discoverability hints. |
| **M9: Diagnostic Doctor** | Complete | `agentswarm doctor` command reporting environment prerequisites and PTY health. |
| **M10: Stage & Rail Layout** | Complete | Split view giving active pane reading focus while monitoring background panes via cards. |
| **M11: Web Audio Synthesis** | Complete | Sub-second two-tone audio cues ($D_5 \to A_5$) for attention escalation without external audio files. |
| **M12: Dynamic Profile Attachment** | Complete | Profile-agnostic session attachment driven by backend capabilities rather than hardcoded strings. |
| **Grounding & Bridge Fix** | Complete | Removed hardcoded cwd fallbacks (`/home/user/...`) and fake mock harness data; real dev bridge implemented. |
| **2027 Cockpit Attention Triage** | Complete | Top-bar `#attention-bar` triage chips, inline `.pane-action-banner` with 1-click HITL buttons, and glowing muster rail lamps. |
| **V2: Cyber-Minimalist Visual Overhaul** | Complete | Full 4-zone CSS refinement: deep `--bg-0` surfaces, gradient-rimmed metric cards, styled launchpad grid, inception card pulse animation, premium buttons with brand glow, sidebar glass header, modal glassmorphism, native scrollbar theming. DESIGN.md token system fully applied. |
| **V2: Architectural Refactoring** | Complete | Purged V1 generic boilerplate (`#grid`, `#rail`, `setLayout`), established headless pane creation, eliminated mock states, and restored 100% test passing functionality under V2 strict rules. Established `AGENT_RULES.md`. |
| **V2: Animated Background & Swarm Constellation** | Complete | 3D WebGL Three.js constellation swarm with glowing multi-agent nodes, proximity laser filaments, GPU-accelerated floating ambient aurora mesh, and frosted obsidian glass surfaces across all 4 zones. |
| **V2: Living Agent Workshop UI/UX** | Complete | Transformed AgentSwarm into an active command center: geometric SVG agent characters with state-driven styling, semantic 3D swarm activity graph with tool bursts and hover HUD, restructured Home workspace with active work stream and editorial sleeping swarm, resizable/collapsible IDE terminal drawer with drag handle and maximize mode, and auto-collapsing contextual right inspector. |

---

## 3. Verified Verification Matrix

Run before every commit:

```bash
# 1. Rust Backend Test Suite (54 tests)
cd app/src-tauri
cargo test

# 2. Frontend / Node Test Suite (46 tests)
cd ../
npm test

# 3. Live Dev Server Check
npm run dev
# Browser verification at http://localhost:1421/harness.html
```


---

## 4. Immediate Roadmap & Backlog

1. **Subagent Tree Visualization**:
   - Parse subagent parent/child relationships from nested Claude Code transcript events and display a hierarchical tree in the Timeline sheet.
2. **Steer API Production Wiring**:
   - Expose the authenticated `steer` Tauri endpoint to external CLI tooling (`agentswarm steer --pane <id> --msg "<text>"`).
3. **Multi-Repo Swarm Profiles**:
   - Support swarms spanning multiple distinct project directories on disk with per-pane working directory scoping.
