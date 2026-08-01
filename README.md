# AgentSwarm

The terminal built for agentic coding.

Running several Claude Code sessions at once means several terminals, and a
terminal shows you output, not understanding. You cannot tell which session is
waiting on you, what any of them decided, or which one touched the file you are
looking at. AgentSwarm is a terminal that can answer those questions, because it
reads Claude Code's own transcripts alongside the live session.

It is a real terminal first. Every feature below is an addition; if any of them
fail, the terminal underneath is untouched.

---

## Install

Windows.

```
cd app && npm install && npx tauri build --no-bundle
```

Then, from the project folder:

```
.\agentswarm                  reopen what you had open
.\agentswarm --swarm morning  open a named swarm
```

To run it from any folder — which is the normal case, since a pane's working
directory decides which project's transcripts and swarms it reads:

```
powershell -ExecutionPolicy Bypass -File scripts\add-to-path.ps1
```

Open a new terminal after that and `agentswarm` works anywhere.

There is also an installer at `app/src-tauri/target/release/bundle/msi/` from
`npx tauri build`. It installs the app; it does **not** put `agentswarm` on your
PATH — use the script above for that.

Build it yourself:

```bash
cd app && npm install && npx tauri build
```

For a portable build with no installer:

```bash
cd app && npx tauri build --no-bundle
```

The binary lands in `app/src-tauri/target/release/agentswarm.exe`.

---

## The one key worth memorising

**`ctrl+shift+P`** opens everything — swarms, panes, search, changes, settings.
Type three letters and press enter. `mrn` finds `morning`.

Everything else is reachable from there, but has a direct key too:

| key | what |
|---|---|
| `ctrl+shift+T` | new pane |
| `ctrl+shift+E` | this pane: raw output ⇄ plain english |
| `ctrl+shift+A` | every pane at once |
| `ctrl+shift+space` | jump to whatever is waiting on you |
| `ctrl+shift+M` | every session, in the order it happened |
| `ctrl+shift+D` | what changed on disk — and **why** |
| `ctrl+shift+F` | search everything ever said in these folders |
| `ctrl+shift+S` | find in this pane's scrollback |
| `ctrl+shift+O` | pin — two panes share the stage |
| `ctrl+shift+C` / `V` | copy / paste (right-click: copy selection, else paste) |
| `ctrl+shift+Z` / `W` | zoom / close |

---

## What it does that a terminal cannot

**Plain english.** Each pane shows the real terminal, or the same live session as
a readable timeline. Both stay loaded, so switching is a change of reading rather
than a reload. Structure comes from Claude Code's transcript, never from scraping
the screen.

**Tells you when it needs you.** Each pane carries a live state — *working*,
*waiting · Bash*, *your turn*, *idle*. The window title carries the count out to
the taskbar, which is the part that works when AgentSwarm is not the window you
are looking at.

**Everything in order.** `ctrl+shift+M` interleaves every session by real time.
With five sessions running, "what happened, in what order" is the question a grid
of terminals structurally cannot answer.

**Why is this line here.** Open a changed file and the diff arrives with the
edits that produced it and what was being said just before each one — cited to
transcript file and line. `git blame` answers who and when; it cannot answer why,
because the reason was never in the repository.

**Swarms.** The panes you always open together, with the folder and policy for
each:

```bash
agentswarm --swarm morning
```

---

## Configuration

Everything lives in `.agentswarm/` next to your project (falling back to
`~/.agentswarm/`). A first run writes a starter `recipes.json` you can edit.

**`recipes.json`** — named swarms:

```json
{
  "recipes": [
    { "name": "review",
      "panes": [
        { "profile": "claude", "label": "reviewer",
          "args": ["--permission-mode", "plan"] }
      ] }
  ]
}
```

`args` are passed to the process verbatim. AgentSwarm never adds a permission
flag of its own — whatever a pane is allowed to do, you wrote down.

**`settings.json`** — thresholds. Written for you from the palette
(`settings`). If the app ever says a pane is waiting when it is not, `stuck_ms`
is the number to raise; a partial file keeps the defaults for everything else.

**`last-layout.json`** — what was open last time, reopened on next launch. Skip
with `--fresh`.

---

## Development

```bash
cd app
npm test                  # the decision logic: state machine, ordering, matching
cd src-tauri && cargo test # parsing, recipes, settings, quoting
```

`app/harness.html` runs the real UI in a browser with Tauri stubbed, recording
every IPC call. It exists because four milestones once shipped verified only by
stdout and unit tests, and the first key a human pressed found a bug.

```bash
npm run dev               # then open /harness.html
```

Two examples drive the real machinery against real data:

```bash
cargo run --release --example semcheck  -- "E:\your\project"      # transcript coverage
cargo run --release --example whycheck  -- "src/thing.rs"          # why is this file this way
cargo run --release --example keycheck  -- claude                  # does a key reach the program
cargo run --release --example ptybench  -- 9 12                    # throughput and keystroke latency
```

---

## Known limits

- Attribution in the *changed files* list only sees panes open right now. The
  per-file "why" view reads all history.
- A file renamed since it was edited will not connect to its history.
- Search matches words, not meaning.
- Windows only so far.
- No tabs. The rail is deliberately the answer to what tabs solve — many
  sessions, little space — but if a week of use says otherwise, that is a
  design decision to revisit with usage data rather than defend.

## Status

Fifteen build cycles, sixty-seven automated tests, a smoke test and a
self-driving recording on every build. The exit tests that matter — *is it my daily driver*,
*does a teammate say whoa*, *five busy sessions and nothing missed* — need a week
of real use, not another feature. See
`AgentSwarm intelligence/03 Plans/P4 - Milestones.md`.
