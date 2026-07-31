//! Pressure-test the semantic layer against real transcripts.
//!
//! Unit tests prove the parser handles the shapes I *expected*. This runs the
//! same `watch()` the app runs, over whatever Claude Code actually wrote on this
//! machine, and reports how much of it we understood. The number that matters is
//! the miss rate: lines we produced no card for.
//!
//!   cargo run --release --example semcheck -- "E:\agent-swarm"

use agentswarm_lib::transcript;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

fn main() {
    let cwd = std::env::args().nth(1).unwrap_or_else(|| ".".into());
    let secs: u64 = std::env::args().nth(2).and_then(|s| s.parse().ok()).unwrap_or(12);

    let dir = transcript::project_dir(&cwd).expect("no home directory");
    println!("transcripts: {}\n", dir.display());

    // ── static pass: every line of every transcript, so coverage is measured on
    //    real data rather than on the handful of shapes I thought to test.
    let (mut lines, mut cards) = (0usize, 0usize);
    let mut by_kind = std::collections::BTreeMap::<String, usize>::new();
    let mut misses: Vec<String> = Vec::new();

    let mut files: Vec<_> = std::fs::read_dir(&dir)
        .map(|d| d.filter_map(|e| e.ok()).map(|e| e.path()).collect())
        .unwrap_or_default();
    files.retain(|p| p.extension().map(|e| e == "jsonl").unwrap_or(false));
    files.sort();

    for f in &files {
        let Ok(text) = std::fs::read_to_string(f) else { continue };
        for line in text.lines() {
            if line.trim().is_empty() {
                continue;
            }
            lines += 1;
            match transcript::parse_line(1, line) {
                Some(c) => {
                    cards += 1;
                    *by_kind.entry(c.kind).or_default() += 1;
                }
                None => {
                    if misses.len() < 6 {
                        // what a miss actually was, so the gap is diagnosable
                        let v: serde_json::Value = serde_json::from_str(line).unwrap_or_default();
                        let role = v
                            .get("message")
                            .and_then(|m| m.get("role"))
                            .and_then(|r| r.as_str())
                            .unwrap_or("-");
                        let t = v.get("type").and_then(|t| t.as_str()).unwrap_or("-");
                        misses.push(format!("type={t} role={role}"));
                    }
                }
            }
        }
    }

    println!("static pass over {} transcript file(s)", files.len());
    println!("  lines read   {lines}");
    println!(
        "  cards built  {cards}  ({:.0}% of lines)",
        if lines > 0 { cards as f64 / lines as f64 * 100.0 } else { 0.0 }
    );
    for (k, n) in &by_kind {
        println!("     {k:<8} {n}");
    }
    if !misses.is_empty() {
        println!("  unrecognised, first few:");
        for m in &misses {
            println!("     {m}");
        }
    }

    // ── live pass: the real watcher, tailing whatever is being written now.
    println!("\nlive pass — watching for {secs}s");
    let seen = Arc::new(AtomicUsize::new(0));
    let s = seen.clone();
    transcript::watch(
        1,
        cwd,
        std::time::SystemTime::now(),
        move |c| {
            let n = s.fetch_add(1, Ordering::Relaxed) + 1;
            if n <= 8 {
                let b: String = c.body.chars().take(72).collect();
                println!("  [{}] {:<8} {}", c.ts, c.kind, b);
            }
        },
        |st| println!("  status: {st}"),
    );

    std::thread::sleep(std::time::Duration::from_secs(secs));
    println!("\n  cards streamed: {}", seen.load(Ordering::Relaxed));
}
