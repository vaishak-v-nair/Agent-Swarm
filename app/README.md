# AgentSwarm

The terminal built for agentic coding.

## Run it

```bash
cd app
npm install
npm run build          # frontend → dist/
cd src-tauri
cargo run --release    # launches the app
```

Live-reload while developing the UI:

```bash
cd app && npx tauri dev
```

## What's here (M1)

A real terminal. Tauri 2 + Rust core, `portable-pty` for ConPTY sessions, xterm.js with the WebGL renderer.

| Key | Does |
|---|---|
| `ctrl+shift+T` | new pane (uses `claude` if it's on PATH, else PowerShell) |
| `ctrl+shift+W` | close the focused pane |
| `ctrl+shift+Z` | zoom the focused pane |
| `ctrl+shift+←/→` | cycle focus |

Panes tile automatically. Profiles are detected at startup — only shells that actually exist appear in the bar.

## Layout

```
app/
├── index.html            shell
├── src/
│   ├── main.js           panes, tiling, xterm wiring
│   └── style.css
└── src-tauri/
    ├── src/
    │   ├── lib.rs        tauri commands, profile detection
    │   ├── pty.rs        PTY spawn / read / write / resize
    │   └── main.rs
    └── tauri.conf.json
```

## The one invariant

**The input path never waits on the output path.** Each pane's reader thread only emits; it never takes the pane lock. Writers take a separate short-lived lock. Break this and typing stalls whenever an agent floods output — which is the failure this whole product exists to fix.

## Not built yet

The semantic layer (M2), the cockpit badges (M3), and recipes (M4). See `AgentSwarm intelligence/03 Plans/P4 - Milestones.md`.
