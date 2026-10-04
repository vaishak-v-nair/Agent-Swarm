# AgentSwarm — Design System & Visual Specification

> **Version**: 2.0.0  
> **Aesthetic Philosophy**: Cyber-Minimalist Developer Cockpit (Vendor-Neutral, Dense, Calm, Futuristic)  
> **Source of Truth**: `app/src/style.css` & `app/src/modules/`

---

## 1. Design Principles

1. **Precision & Density**: Developer workstations must not waste screen real estate on exaggerated margins, huge empty cards, or decorative filler. Every pixel must earn its presence.
2. **Quiet Dignity**: When ten agents are working smoothly, the UI remains calm, dark, and focused. When human judgment is required, high-contrast, glowing status indicators surface immediately.
3. **Hardware Grounding**: The terminal is not a fake simulation. The aesthetic balances sleek glassmorphism with rugged monospace terminal fidelity.
4. **Vendor Neutrality**: No single provider brand (Anthropic orange, OpenAI teal, Google blue) dominates the workspace. AgentSwarm has its own distinct, unified cyber-rose accent, with individual agent providers identified by consistent semantic badges.

---

## 2. Color Palette & Surface Tokens

### Surfaces & Backgrounds
| Token | Hex | Role |
|---|---|---|
| `--bg-0` | `#0b0c0e` | Deep canvas (terminal drawer, root shell) |
| `--bg-1` | `#111215` | Structural sidebar, top navigation, context inspector |
| `--bg-2` | `#17181d` | Main workspace cards, panels, list items |
| `--bg-3` | `#1e2026` | Modals, elevated dialogs, popovers |
| `--bg-hover` | `#252830` | Hovered rows, interactive elements |
| `--bg-active`| `#2d303b` | Active selections, selected tabs |

### Borders & Glass Overlays
| Token | Value | Role |
|---|---|---|
| `--border-subtle` | `rgba(255, 255, 255, 0.05)` | Hairline dividers between sections |
| `--border-default`| `rgba(255, 255, 255, 0.09)` | Standard container borders |
| `--border-lit`    | `rgba(255, 255, 255, 0.16)` | Card borders, inputs, hovered borders |
| `--border-active` | `rgba(244, 63, 94, 0.45)`    | Focused elements, active tasks |
| `--glass-panel`   | `rgba(17, 18, 21, 0.85)`    | Translucent blur surfaces (`backdrop-filter: blur(16px)`) |

### Brand & Agent Semantic Accents
| Token / Provider | Hex | Role |
|---|---|---|
| `--brand-primary` | `#f43f5e` | Cyber Rose (Action buttons, primary highlights) |
| `--brand-glow`    | `rgba(244, 63, 94, 0.25)` | Micro-glow effects on active badges |
| `Claude Code`     | `#e09f58` | Solar Amber |
| `OpenAI Codex`    | `#10b981` | Emerald Green |
| `Gemini CLI`      | `#38bdf8` | Electric Cyan |
| `GitHub Copilot`  | `#a855f7` | Neon Violet |
| `OpenCode`        | `#14b8a6` | Cyber Teal |
| `Native Shell`    | `#6366f1` | Deep Indigo |

### Attention Levels
| Level | Color | Glow Token |
|---|---|---|
| `nominal` / `working` | `#10b981` (Emerald) | `0 0 8px rgba(16, 185, 129, 0.4)` |
| `waiting`             | `#f59e0b` (Amber)   | `0 0 8px rgba(245, 158, 11, 0.4)` |
| `urgent`              | `#ef4444` (Crimson) | `0 0 12px rgba(239, 68, 68, 0.6)` |

---

## 3. Typography System

- **UI Sans**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, Inter, sans-serif`
- **Code & Monospace**: `"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, Menlo, monospace`

| Style | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| `Display Title` | `18px` | `700` | `1.2` | `-0.02em` |
| `Section Head`  | `13px` | `600` | `1.3` | `-0.01em` |
| `Body Standard` | `12px` | `400` | `1.4` | `0` |
| `Caption / Label`| `10.5px`| `600` | `1.2` | `0.05em (uppercase)` |
| `Code Snippet`  | `11.5px`| `500` | `1.5` | `0` |

---

## 4. 4-Zone Shell Specifications

1. **Top Bar (`#bar`)**: Height 38px. Translucent dark header with subtle border-bottom. Left brand title, center muster rail and attention triage queue, right keyboard shortcut pills.
2. **Left Sidebar (`#sidebar`)**: Width 250px. Fixed left navigation. Project selector dropdown, `+ New Agent Task` button, Navigation pills (Home, Changes, Timeline), and live Agent Sessions list with active task status dots.
3. **Main Workspace (`#main-workspace`)**: Flex-fill center canvas.
   - **Home View**: Active project hero, 4-metric grid, 1-click Quick Launchpad for detected agents, attention callout card, and recent agent task cards.
   - **Session View**: Task title bar, Agent badge, Status pill, 4 workspace tabs (`Conversation`, `Changes`, `Verification`, `Raw Terminal`), and the Task Inception Card.
4. **Right Context Inspector (`#context-inspector`)**: Width 270px. Project environment, branch pill, verification evidence badge (`✓ Verified`), real modified files diff list, and attention provenance.
5. **Execution Drawer (`#terminal-drawer`)**: Collapsible bottom drawer (closed: 34px bar, open: 280px). Hosts genuine xterm.js terminals attached to ConPTY subprocesses.

---

## 5. Micro-Animations & Interactivity

- **Pulse Indicators**: Animated glowing dots (`@keyframes pulseGlow`) for active and waiting sessions.
- **Button Hover**: Smooth brightness lift (`filter: brightness(1.12)`) and 1px translateY.
- **Card Hover**: Subtle border illumination (`border-color: var(--border-lit)`) and background tint.
- **Drawer Slide**: Fast cubic-bezier spring transition (`height 0.18s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Modal Backdrop**: Blur in `0.12s ease-out` with smooth modal card zoom (`transform: scale(0.98) -> scale(1)`).
