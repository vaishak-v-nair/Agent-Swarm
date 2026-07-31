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

/// What a pane runs. Resolved here rather than in the UI so the frontend never
/// builds a command line — it names a profile, the backend decides the argv.
///
/// `args` are extra flags from a recipe, which is how a per-pane policy profile
/// is expressed: the recipe says `--permission-mode plan`, and this passes it
/// through. AgentSwarm never invents a permission flag of its own — whatever the
/// pane is allowed to do, the user wrote down.
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
    use super::ps_quote;

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
    cols: u16,
    rows: u16,
) -> anyhow::Result<()> {
    let pair = native_pty_system().openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = resolve(profile, args);
    if let Some(dir) = cwd {
        if std::path::Path::new(&dir).is_dir() {
            cmd.cwd(dir);
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
