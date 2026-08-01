//! PTY layer.
//!
//! One rule drives the design: the input path must never wait on the output path.
//! Agents write in bursts of hundreds of KB; if a keystroke has to queue behind
//! that, the terminal feels broken under exactly the load it exists to handle.
//!
//! So: each pane owns a reader thread that only ever emits, and a writer held
//! behind its own short-lived lock. Nothing reads and writes under one mutex.

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

pub struct Pane {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

#[derive(Default)]
pub struct Panes(pub Mutex<HashMap<u32, Pane>>);

/// Where PTY output goes. The app sends it to the webview; the benchmark counts
/// bytes. Keeping this abstract is what lets the latency test exercise the real
/// spawn/read/write code instead of a lookalike copy of it.
pub trait Sink: Send + Sync + 'static {
    fn data(&self, id: u32, text: &str);
    fn exit(&self, id: u32);
}

/// Wrap a string so PowerShell reads it as one literal argument. Single quotes
/// suppress every expansion PowerShell would otherwise perform — `$`, backtick,
/// subexpressions — and a literal quote is written by doubling it.
///
/// This matters more than it looks: recipe arguments come from a file on disk,
/// and a file on disk is exactly the kind of input that should not be able to
/// become executable PowerShell.
fn ps_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

/// Strip the environment that marks *this* process as living inside a Claude
/// Code session, and report what was removed.
///
/// This is not a nicety. AgentSwarm is usually launched from a terminal — often
/// one already running Claude Code — and a child process inherits the whole
/// environment, including `CLAUDE_CODE_CHILD_SESSION`. A `claude` that sees that
/// marker believes it is a nested sub-session and turns itself down accordingly:
///
///     ⚠ Transcript saving is off — inherited CLAUDE_CODE_CHILD_SESSION marker
///
/// With transcript saving off there is no transcript, so the semantic layer has
/// nothing to follow and prompt history has nowhere to live. Two headline
/// features and the up-arrow all fail at once, for a reason that is invisible
/// unless you read the pane's own banner.
///
/// A pane is a top-level session. It must start from a clean slate.
///
/// `ANTHROPIC_BASE_URL` is removed only when a nested marker was present: in
/// that case it points at the *parent* session's proxy and routing a new session
/// through it is wrong. Left alone otherwise, because a user who set it meant it.
pub fn scrub_session_env(cmd: &mut CommandBuilder) -> Vec<String> {
    let nested = std::env::var_os("CLAUDE_CODE_CHILD_SESSION").is_some()
        || std::env::var_os("CLAUDECODE").is_some();

    let mut removed = Vec::new();
    for (key, _) in std::env::vars_os() {
        let Some(k) = key.to_str() else { continue };
        let strip = k.starts_with("CLAUDE_CODE_")
            || k.starts_with("CLAUDE_PREVIEW_")
            || matches!(k, "CLAUDECODE" | "CLAUDE_PID" | "CLAUDE_EFFORT" | "CLAUDE_AGENT_SDK_VERSION")
            || (nested && k == "ANTHROPIC_BASE_URL");
        if strip {
            cmd.env_remove(k);
            removed.push(k.to_string());
        }
    }
    removed.sort();
    removed
}

/// What a pane runs. Resolved here rather than in the UI so the frontend never
/// builds a command line — it names a profile, the backend decides the argv.
///
/// `args` are extra flags from a recipe, which is how a per-pane policy profile
/// is expressed: the recipe says `--permission-mode plan`, and this passes it
/// through. AgentSwarm never invents a permission flag of its own — whatever the
/// pane is allowed to do, the user wrote down.
/// A command defined in settings rather than known to this file.
pub struct Custom<'a> {
    pub command: &'a str,
    pub args: &'a [String],
    pub keep_open: bool,
}

/// M11 — a profile the user defined. Built through the same PowerShell wrapper
/// and the same quoting as the built-ins, so a command from a settings file
/// cannot become executable script any more than a recipe argument can.
pub fn resolve_custom(c: &Custom, extra: &[String]) -> CommandBuilder {
    if c.keep_open {
        let mut line = String::new();
        // The command itself is quoted too. It comes from a file on disk.
        line.push_str(&format!("& {}", ps_quote(c.command)));
        for a in c.args.iter().chain(extra.iter()) {
            line.push(' ');
            line.push_str(&ps_quote(a));
        }
        let mut cmd = CommandBuilder::new("powershell.exe");
        cmd.args(["-NoLogo", "-NoExit", "-Command", &line]);
        cmd
    } else {
        let mut cmd = CommandBuilder::new(c.command);
        cmd.args(c.args);
        cmd.args(extra);
        cmd
    }
}

pub fn resolve(profile: &str, args: &[String]) -> CommandBuilder {
    match profile {
        "claude" => {
            // Claude Code inside PowerShell so the session survives the agent exiting.
            let mut line = String::from("claude");
            for a in args {
                line.push(' ');
                line.push_str(&ps_quote(a));
            }
            let mut c = CommandBuilder::new("powershell.exe");
            c.args(["-NoLogo", "-NoExit", "-Command", &line]);
            c
        }
        "wsl" => {
            let mut c = CommandBuilder::new("wsl.exe");
            c.args(args);
            c
        }
        "cmd" => {
            let mut c = CommandBuilder::new("cmd.exe");
            c.args(args);
            c
        }
        "pwsh" => {
            let mut c = CommandBuilder::new("pwsh.exe");
            c.args(["-NoLogo"]);
            c.args(args);
            c
        }
        // powershell is the safe default: present on every Windows box
        _ => {
            let mut c = CommandBuilder::new("powershell.exe");
            c.args(["-NoLogo"]);
            c.args(args);
            c
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ps_quote, scrub_session_env};
    use portable_pty::CommandBuilder;

    /// This test mutates process environment, so it must not run beside another
    /// that reads it. Nothing else here touches env.
    #[test]
    fn a_profile_from_settings_is_quoted_like_everything_else() {
        use super::{resolve_custom, Custom};
        // A command name out of a settings file gets the same treatment as a
        // recipe argument: quoted, inert, never script.
        let args = vec!["--flag".to_string()];
        let c = Custom { command: "qm; rm -rf /", args: &args, keep_open: true };
        let built = format!("{:?}", resolve_custom(&c, &[]));
        assert!(built.contains("'qm; rm -rf /'"), "command must be quoted: {built}");
        assert!(built.contains("'--flag'"), "args must be quoted: {built}");
    }

    #[test]
    fn a_pane_does_not_inherit_the_session_that_launched_the_app() {
        // The bug: AgentSwarm launched from a terminal running Claude Code passed
        // CLAUDE_CODE_CHILD_SESSION to every pane. Each pane then believed it was
        // a nested sub-session and disabled transcript saving — which silently
        // killed the semantic layer, the state machine's tool signal, and prompt
        // history all at once. E:\agent-swarm accumulated zero history entries.
        std::env::set_var("CLAUDE_CODE_CHILD_SESSION", "1");
        std::env::set_var("CLAUDE_CODE_SESSION_ID", "abc");
        std::env::set_var("CLAUDECODE", "1");
        std::env::set_var("CLAUDE_PID", "999");
        std::env::set_var("ANTHROPIC_BASE_URL", "http://127.0.0.1:1/parent-proxy");

        let mut cmd = CommandBuilder::new("cmd.exe");
        let removed = scrub_session_env(&mut cmd);

        for k in ["CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ID", "CLAUDECODE", "CLAUDE_PID"] {
            assert!(removed.iter().any(|r| r == k), "{k} should have been cleared");
        }
        // the parent's proxy goes too, but only because a nested marker was present
        assert!(removed.iter().any(|r| r == "ANTHROPIC_BASE_URL"));

        // and nothing a shell actually needs is touched
        for k in ["PATH", "USERPROFILE", "SystemRoot"] {
            assert!(!removed.iter().any(|r| r.eq_ignore_ascii_case(k)), "{k} must survive");
        }

        for k in ["CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ID", "CLAUDECODE",
                  "CLAUDE_PID", "ANTHROPIC_BASE_URL"] {
            std::env::remove_var(k);
        }
    }

    #[test]
    fn a_users_own_base_url_survives_outside_a_nested_session() {
        // no child markers set: ANTHROPIC_BASE_URL is the user's own choice
        std::env::remove_var("CLAUDE_CODE_CHILD_SESSION");
        std::env::remove_var("CLAUDECODE");
        std::env::set_var("ANTHROPIC_BASE_URL", "https://my-gateway.example");

        let mut cmd = CommandBuilder::new("cmd.exe");
        let removed = scrub_session_env(&mut cmd);
        assert!(!removed.iter().any(|r| r == "ANTHROPIC_BASE_URL"),
                "a base URL the user set themselves must not be stripped");

        std::env::remove_var("ANTHROPIC_BASE_URL");
    }

    #[test]
    fn quoting_neutralises_powershell() {
        assert_eq!(ps_quote("plan"), "'plan'");
        // a quote is escaped by doubling, so the string cannot be closed early
        assert_eq!(ps_quote("it's"), "'it''s'");
        // the classic break-out attempt stays inert text
        assert_eq!(ps_quote("'; rm -rf /; '"), "'''; rm -rf /; '''");
        // PowerShell expands none of these inside single quotes
        assert_eq!(ps_quote("$(whoami)"), "'$(whoami)'");
        assert_eq!(ps_quote("$env:PATH"), "'$env:PATH'");
    }
}

pub fn spawn<S: Sink>(
    sink: Arc<S>,
    panes: Arc<Panes>,
    id: u32,
    profile: &str,
    cwd: Option<String>,
    args: &[String],
    custom: Option<Custom>,
    cols: u16,
    rows: u16,
) -> anyhow::Result<()> {
    let pair = native_pty_system().openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = match &custom {
        Some(c) => resolve_custom(c, args),
        None => resolve(profile, args),
    };
    if let Some(dir) = cwd {
        if std::path::Path::new(&dir).is_dir() {
            cmd.cwd(dir);
        }
    }
    // Let anything running in a pane know it is in one. The baseline log reads
    // this to record which surface an incident happened on, which is the whole
    // comparison the week is for — the same three dimensions, CLI versus here.
    cmd.env("AGENTSWARM", env!("CARGO_PKG_VERSION"));
    cmd.env("AGENTSWARM_PANE", id.to_string());

    let scrubbed = scrub_session_env(&mut cmd);
    if !scrubbed.is_empty() {
        // Say it out loud — a pane that quietly behaves differently depending on
        // what launched the app is the worst kind of bug to be handed. But say it
        // in full only once: nine panes repeating the same nineteen names buries
        // every other line in the log, which is its own kind of silence.
        use std::sync::atomic::{AtomicBool, Ordering};
        static TOLD: AtomicBool = AtomicBool::new(false);
        if TOLD.swap(true, Ordering::Relaxed) {
            println!("[rust] pane {id}: cleared {} inherited session vars", scrubbed.len());
        } else {
            println!("[rust] pane {id}: cleared {} inherited session vars: {}",
                     scrubbed.len(), scrubbed.join(" "));
        }
    }

    let mut child = pair.slave.spawn_command(cmd)?;
    drop(pair.slave); // release the slave handle or the reader never sees EOF

    let mut reader = pair.master.try_clone_reader()?;
    let writer = pair.master.take_writer()?;

    panes.0.lock().unwrap().insert(
        id,
        Pane {
            master: pair.master,
            writer,
        },
    );

    // Reader thread: emit and nothing else. Never touches the panes lock, so a
    // busy agent can never block a keystroke or a resize.
    std::thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // PTY bytes are not guaranteed to split on char boundaries.
                    let text = String::from_utf8_lossy(&buf[..n]);
                    sink.data(id, text.as_ref());
                }
                Err(_) => break,
            }
        }
        let _ = child.wait();
        sink.exit(id);
    });

    Ok(())
}

pub fn write(panes: &Panes, id: u32, data: &str) {
    if let Some(p) = panes.0.lock().unwrap().get_mut(&id) {
        let _ = p.writer.write_all(data.as_bytes());
        let _ = p.writer.flush();
    }
}

pub fn resize(panes: &Panes, id: u32, cols: u16, rows: u16) {
    if let Some(p) = panes.0.lock().unwrap().get(&id) {
        let _ = p.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        });
    }
}

pub fn kill(panes: &Panes, id: u32) {
    panes.0.lock().unwrap().remove(&id);
}
