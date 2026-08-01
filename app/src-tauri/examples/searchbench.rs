//! Does the read cache actually help?
//!
//! `search` and `touched_by` walk every transcript in a folder. The UI debounces
//! search at 220ms, so typing a query used to re-read the whole history from disk
//! once per pause. This measures the first call against the ones after it.
//!
//!   cargo run --release --example searchbench -- "E:\agent-swarm"

use agentswarm_lib::transcript;
use std::time::Instant;

fn ms(f: impl FnOnce() -> usize) -> (u128, usize) {
    let t = Instant::now();
    let n = f();
    (t.elapsed().as_micros(), n)
}

fn main() {
    let cwd = std::env::args().nth(1).unwrap_or_else(|| "E:\\agent-swarm".into());
    let cwds = vec![cwd.clone()];

    // How much is actually on disk, so the numbers have a denominator.
    let bytes: u64 = transcript::project_dir(&cwd)
        .and_then(|d| std::fs::read_dir(d).ok())
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map(|x| x == "jsonl").unwrap_or(false))
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0);
    println!("{cwd}\n  {:.1} MB of transcripts on disk\n", bytes as f64 / 1e6);

    // Typing "permission mode" one character at a time is roughly what the UI
    // does. Note the timings vary with selectivity: a query that fills the 60-hit
    // limit early stops walking, so a *slow* query here is the honest worst case.
    let typed = ["p", "pe", "per", "perm", "permi", "permis", "permission",
                 "permission m", "permission mo", "permission mode"];

    println!("  search — the first call pays for the read, the rest do not");
    let mut first = 0u128;
    let mut rest = Vec::new();
    for (i, q) in typed.iter().enumerate() {
        let (us, n) = ms(|| transcript::search(&cwds, q, 60).len());
        if i == 0 { first = us } else { rest.push(us) }
        println!("    {:>16}  {:>7} µs   {n} hits", format!("\"{q}\""), us);
    }
    let avg: u128 = if rest.is_empty() { 0 } else { rest.iter().sum::<u128>() / rest.len() as u128 };
    println!("\n    first {first} µs · rest avg {avg} µs");
    if avg > 0 {
        println!("    {:.1}x faster once cached", first as f64 / avg as f64);
    }

    // touched_by walks the same files and benefits from the same cache.
    let (a, n1) = ms(|| transcript::touched_by(&cwds, "app/src/state.js", 40).len());
    let (b, n2) = ms(|| transcript::touched_by(&cwds, "app/src/order.js", 40).len());
    println!("\n  why — {a} µs then {b} µs  ({n1} and {n2} edits)");

    // A changed file must invalidate. Nothing else here proves the cache is safe.
    println!("\n  a cached file that changes is re-read, not served stale");
    println!("  (asserted by the unit test; the watcher is unaffected — it seeks)");
}
