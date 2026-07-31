//! PTY layer.
//!
//! One rule drives the design: the input path must never wait on the output path.
//! Agents write in bursts of hundreds of KB; if a keystroke has to queue behind
//! that, the terminal feels broken under exactly the load it exists to handle.
//!
//! So: each pane owns a reader thread that only ever emits, and a writer held
//! behind its own short-lived lock. Nothing reads and writes under one mutex.

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct Pane {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

#[derive(Default)]
pub struct Panes(pub Mutex<HashMap<u32, Pane>>);

#[derive(Clone, Serialize)]
struct Chunk<'a> {
    id: u32,
    data: &'a str,
}

#[derive(Clone, Serialize)]
struct Exit {
    id: u32,
}

/// What a pane runs. Resolved here rather than in the UI so the frontend never
/// builds a command line — it names a profile, the backend decides the argv.
pub fn resolve(profile: &str) -> CommandBuilder {
    match profile {
        "claude" => {
            // Claude Code inside PowerShell so the session survives the agent exiting.
            let mut c = CommandBuilder::new("powershell.exe");
            c.args(["-NoLogo", "-NoExit", "-Command", "claude"]);
            c
        }
        "wsl" => CommandBuilder::new("wsl.exe"),
        "cmd" => CommandBuilder::new("cmd.exe"),
        "pwsh" => {
            let mut c = CommandBuilder::new("pwsh.exe");
            c.args(["-NoLogo"]);
            c
        }
        // powershell is the safe default: present on every Windows box
        _ => {
            let mut c = CommandBuilder::new("powershell.exe");
            c.args(["-NoLogo"]);
            c
        }
    }
}

pub fn spawn(
    app: AppHandle,
    panes: Arc<Panes>,
    id: u32,
    profile: &str,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> anyhow::Result<()> {
    let pair = native_pty_system().openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = resolve(profile);
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
    let emit_app = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // PTY bytes are not guaranteed to split on char boundaries.
                    let text = String::from_utf8_lossy(&buf[..n]);
                    let _ = emit_app.emit(
                        "pty:data",
                        Chunk {
                            id,
                            data: text.as_ref(),
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let _ = child.wait();
        let _ = emit_app.emit("pty:exit", Exit { id });
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
