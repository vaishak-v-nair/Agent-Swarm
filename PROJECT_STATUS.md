# AgentSwarm — Living Project Status

> **Notice to AI Agents**: This file is the single source of operational truth for project state. Review this file at the start of each session and update it before concluding.

**Last Updated**: 2026-10-02  
**Current Git Branch**: `main`  
**Latest Commit**: `d0e405d` (*feat(uiux): implement 2027 agent cockpit triage queue and inline action banners*)  
**Test Suite Health**: **91 / 91 Tests Passing (100% Green)**  
- Rust backend: 48 passed, 0 failed (`cargo test`)
- Frontend/Node: 43 passed, 0 failed (`npm test`)

---

## 1. System Architecture Snapshot

AgentSwarm is a native Windows desktop cockpit designed for multi-agent supervision (Claude Code, Codex, PowerShell, custom agent swarms).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AgentSwarm Cockpit UI                           │
│  [Muster Rail] [Attention Queue Chips] [Tally] [Keyboard Shortcuts]   │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Pane 1 (Stage / Reading Focus)  │  Rail (Live Monitored Cards)        │
│  ┌────────────────────────────┐  │  ┌───────────────────────────────┐  │
│  │ ⚡ Pane Action Banner      │  │  │ #2 · claude [running 42s]     │  │
│  │ [Approve (y)] [Reject (n)] │  │  │ peek: "Building AST tree..."  │  │
│  ├────────────────────────────┤  │  └───────────────────────────────┘  │
│  │ ConPTY Terminal (xterm.js) │  │  ┌───────────────────────────────┐  │
│  │ or Semantic Flow Cards     │  │  │ #3 · test-agent [idle 1m]     │  │
│  └────────────────────────────┘  │  └───────────────────────────────┘  │
└──────────────────────────────────┴─────────────────────────────────────┘
                 ▲                                     ▲
          Tauri IPC (Webview)                   Tauri IPC (Webview)
                 ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Rust Backend Core                             │
│  ┌─────────────────────────┐         ┌──────────────────────────────┐  │
│  │ ConPTY Manager (pty.rs) │         │ Transcript Watcher & Parser  │  │
│  │ Real Windows Subprocess │         │ (Claude Code & Codex JSONL)  │  │
│  └─────────────┬───────────┘         └──────────────┬───────────────┘  │
│                │                                    │                  │
│                ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ SQLite Agent Event Store (store.rs)                              │  │
│  │ Events: ToolCall, ToolResult, UserPrompt, Bell, Exit, Diff       │  │
│  └─────────────────────────────┬────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Attention Engine (attention.rs)                                  │  │
│  │ Priority Scoring (0-100) + Half-Life Decay (tau = 45s)           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Completed Milestones & Capabilities

| Milestone / Feature | Status | Description |
|---|---|---|
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

---

## 3. Verified Verification Matrix

Run before every commit:

```bash
# 1. Rust Backend Test Suite (48 tests)
cd app/src-tauri
cargo test

# 2. Frontend / Node Test Suite (43 tests)
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
