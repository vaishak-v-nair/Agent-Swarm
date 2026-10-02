//! Why is this file the way it is?
//!
//! Proves `transcript::touched_by` against the real transcripts on this machine
//! before any of it reaches the UI. A diff says what changed; this is supposed to
//! say why, and "supposed to" is not a claim worth shipping unmeasured.
//!
//!   cargo run --release --example whycheck -- "app/src-tauri/src/transcript.rs"

use agentswarm_lib::transcript;

fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| "app/src/main.js".into());
    let cwd = std::env::args().nth(2).unwrap_or_else(|| {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".into())
    });

    let hits = transcript::touched_by(&[cwd.clone()], &path, 40);
    println!("{path}\n  {} edit(s) found across all history\n", hits.len());

    for h in hits.iter().take(10) {
        let when = h.iso.get(..16).unwrap_or(&h.iso);
        println!("  {when}  {} — {}:{}", h.title, h.session, h.line);
        if !h.context.is_empty() {
            let why: String = h.context.chars().take(150).collect();
            println!("      why: {why}");
        }
    }
    if hits.len() > 10 {
        println!("  … and {} more", hits.len() - 10);
    }
    if hits.is_empty() {
        println!("  (nothing — either the file was never edited by an agent here,");
        println!("   or the path does not match how the transcript recorded it)");
    }
}
