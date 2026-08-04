---
covers: M13 through publish readiness
date: 2026-08-01
commits: ad50f65 → 7734028
status: shipped
---

# B13 — The Publish Sprint

One consolidated log for the stretch after [[B12 - M12 Not Just Claude Code]]:
the Codex reader, the verification loop, the terminal basics, and everything
publishing demanded. Sixteen commits.

## What shipped

**M13 — a second reader** (`ad50f65`). Codex rollouts, learned from real files on
this machine. 356 lines → 217 cards on a real session, `call_id` pairing intact.
Codex nests sessions by date, so `newest()` walks bounded-recursively now.

**Speed, measured** (`818d7c1`, `3811bd3`). The read cache bought nothing — the
OS page cache already had the files. The real cost was `to_lowercase()` per line
per query: worst query **3,664 ms → 96 ms** by storing each line twice, raw and
lowered. The benchmark once claimed a test that did not exist; the test exists
now (`a_changed_file_is_re_read_rather_than_served_stale`).

**M14 — the app proves itself** (`c0abd15`), from [[P8 - CEO Review, the Verification Gap|P8]]. `npm run smoke` drives the real binary; `--doctor` checks
seven things and every failure prints its fix; `npm run verified` gates the word.
Then `--demo` (`dda008c`): the app drives its own UI from inside — real commands,
pane switches, every overlay — zero OS input. `npm run record` films it.

**Design, from looking** (`6c68dd3`, `53b7d7f`). The recorder's first frame
showed what thirteen milestones never had: dead rail space, a peek reading "8"
then "─────", invisible muster lamps. Fixed by iterating against recordings. The
peek now prefers the last *card* over the last terminal line — the last line of
a full-screen agent is its status footer, chrome not work.

**The terminal basics** (`d942b1b`). Copy/paste (Rust/arboard, right-click
convention), find-in-scrollback (`ctrl+shift+S`), clickable links (validated in
Rust, `rundll32`, never a shell), the settings sheet (merge-saves; a test proves
it cannot delete hand-written profiles), pin (`ctrl+shift+O`, two panes share
the stage). Found and fixed a WebView2 renderer crash: re-parenting a WebGL
canvas twice in one tick → white window. Panes move at most once per layout
change.

**The error dialogs** (`c3a082c`). Application log: conhost.exe "stopped
interacting". The app never killed its children on exit; each orphaned headless
conhost raised a dialog. Measured +2 orphans per run. Fix: a **Job Object** with
kill-on-close — the OS kills every descendant however the app dies. Measured 0
after. Plus a panic hook → `%LOCALAPPDATA%\agentswarm\panic.log`, surfaced by
doctor.

**The site and the film** (`c3a082c`, `17e339f`, `7734028`). `site/` is
self-contained: hero is the self-driving recording, install is the content,
SmartScreen honesty, a "what it does not do" section. The intro was cut three
times: static captions (fairly called a child's edit) → reference-grammar
floating window → a real edit: seven shots from a contact sheet, 2× close-ups,
zoompan push-ins on 4fps capture, lower-thirds on cards, 30.5s. Every caption
names exactly what its shot shows.

## The rule that took seven bugs

Backslashes died in heredocs, Python replacements, and shell fixtures **seven
times** this project. The rule, finally applied everywhere: anything containing
a backslash is written with Write/Edit, never through a scripted replacement;
paths are built where paths belong (Rust `PathBuf`) and handed over finished;
test fixtures with escapes live in files, not shells.

## Numbers at close

37 Rust tests · 28 JS tests · smoke passing · 0 orphaned processes ·
fresh MSI · site 13 KB self-contained · film 30.5s/3.7 MB.

See [[NEXT SESSION]] for what remains.
