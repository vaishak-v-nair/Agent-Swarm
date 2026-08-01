//! Does a key actually reach the program in the pane?
//!
//! The UI was reported to not recall history on the up arrow. The frontend was
//! measured first and is fine — xterm emits ESC[A and pty_write receives it — so
//! this drives the other half: spawn a real program through the real `pty::spawn`,
//! send a real escape sequence, and print what comes back.
//!
//!   cargo run --release --example keycheck -- powershell
//!   cargo run --release --example keycheck -- claude
//!
//! Reading the result: a program that handled the key redraws its input line, so
//! the delta contains the recalled text. A program that ignored it emits nothing,
//! or only a repaint.

use agentswarm_lib::pty::{spawn, Panes, Sink};
use std::sync::{Arc, Mutex};

struct Buf(Mutex<String>);
impl Sink for Buf {
    fn data(&self, _id: u32, text: &str) {
        self.0.lock().unwrap().push_str(text);
    }
    fn exit(&self, _id: u32) {}
}

/// Escape sequences are invisible in a diff, so make them readable. Cursor
/// positioning and colour are noise here; the text is the signal.
fn readable(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\x1b' => {
                let mut seq = String::new();
                if chars.peek() == Some(&'[') || chars.peek() == Some(&'O') {
                    seq.push(chars.next().unwrap());
                    while let Some(&n) = chars.peek() {
                        seq.push(n);
                        chars.next();
                        if n.is_ascii_alphabetic() || n == '~' {
                            break;
                        }
                    }
                }
                // keep only sequences that change content, not the cursor dance
                if seq.ends_with('J') || seq.ends_with('K') {
                    out.push_str("‹clear›");
                }
            }
            '\r' => out.push_str("⏎"),
            '\n' => out.push('\n'),
            c if (c as u32) < 32 => {}
            c => out.push(c),
        }
    }
    out
}

fn main() -> anyhow::Result<()> {
    let profile = std::env::args().nth(1).unwrap_or_else(|| "powershell".into());
    let cwd = std::env::args().nth(2).unwrap_or_else(|| "E:\\agent-swarm".into());
    let boot: u64 = std::env::args().nth(3).and_then(|s| s.parse().ok()).unwrap_or(10);

    let buf = Arc::new(Buf(Mutex::new(String::new())));
    let panes = Arc::new(Panes::default());
    spawn(buf.clone(), panes.clone(), 1, &profile, Some(cwd.clone()), &[], None, 120, 30)?;

    println!("profile={profile} cwd={cwd}\nwaiting {boot}s for it to come up…");
    std::thread::sleep(std::time::Duration::from_secs(boot));

    let seed = |b: &Arc<Buf>| b.0.lock().unwrap().len();
    let since = |b: &Arc<Buf>, n: usize| b.0.lock().unwrap()[n..].to_string();

    // Look at the screen before drawing conclusions from it. A program sitting on
    // a first-run prompt, or not yet booted, ignores the arrow for reasons that
    // have nothing to do with the terminal.
    {
        let all = buf.0.lock().unwrap().clone();
        let text = readable(&all);
        let tail: String = text.chars().rev().take(900).collect::<Vec<_>>().into_iter().rev().collect();
        println!("── what is on screen after boot ({} bytes total) ──\n{tail}\n", all.len());
    }

    // Seed some history for a shell. Claude Code already has per-project prompt
    // history, so it needs nothing typed at it — and nothing is sent to the API.
    if profile != "claude" {
        agentswarm_lib::pty::write(&panes, 1, "echo agentswarm-history-probe\r");
        std::thread::sleep(std::time::Duration::from_secs(2));
    }

    // Ordered so each step isolates one question. "The arrow did nothing" has two
    // very different causes — the key never arrived, or it arrived and there was
    // nothing to recall — and they need opposite fixes.
    let steps: &[(&str, &str, u64)] = &[
        ("type 'abc'            — do keys arrive at all?", "abc", 1200),
        ("ESC[D  left arrow     — do arrows arrive?", "\x1b[D", 1200),
        ("ESC[C  right arrow", "\x1b[C", 900),
        ("backspace x3          — clear the box", "\x7f\x7f\x7f", 1200),
        ("ESC[A  up, box empty  — the reported bug", "\x1b[A", 1800),
        ("ESC O A up, app-cursor mode", "\x1bOA", 1800),
    ];

    for (name, seq, wait) in steps {
        let mark = seed(&buf);
        agentswarm_lib::pty::write(&panes, 1, seq);
        std::thread::sleep(std::time::Duration::from_millis(*wait));
        let delta = since(&buf, mark);
        let text = readable(&delta);
        println!("\n── {name} ──");
        println!("   {} bytes back", delta.len());
        let shown: String = text.chars().take(400).collect();
        println!("   text: {}", if shown.trim().is_empty() { "(none)".into() } else { shown });
        if delta.len() <= 64 {
            // small deltas are usually pure cursor movement, which readable() hides
            println!("   raw:  {}", delta.escape_debug());
        }
    }

    agentswarm_lib::pty::kill(&panes, 1);
    Ok(())
}
