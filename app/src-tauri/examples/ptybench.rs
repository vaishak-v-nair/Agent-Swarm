//! Pressure test for the one claim the product rests on:
//! **input never waits on output.**
//!
//! Spawns N real PTYs through the same `pty::spawn` the app uses, floods every
//! one of them with output, and — while that flood is running — measures how
//! long a single keystroke takes to reach its pane. If the reader threads ever
//! contended with the writer, that number would climb with the load.
//!
//!     cargo run --release --bin ptybench -- [panes] [seconds]

use agentswarm_lib::pty::{self, Panes, Sink};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

struct Counter {
    bytes: AtomicU64,
    chunks: AtomicU64,
}

impl Sink for Counter {
    fn data(&self, _id: u32, text: &str) {
        self.bytes.fetch_add(text.len() as u64, Ordering::Relaxed);
        self.chunks.fetch_add(1, Ordering::Relaxed);
    }
    fn exit(&self, _id: u32) {}
}

fn pct(sorted: &[u128], p: f64) -> u128 {
    if sorted.is_empty() {
        return 0;
    }
    let i = ((sorted.len() - 1) as f64 * p).round() as usize;
    sorted[i]
}

fn main() -> anyhow::Result<()> {
    let a: Vec<String> = std::env::args().collect();
    let n: u32 = a.get(1).and_then(|s| s.parse().ok()).unwrap_or(6);
    let secs: u64 = a.get(2).and_then(|s| s.parse().ok()).unwrap_or(10);

    println!("\n  AgentSwarm PTY pressure test");
    println!("  {n} panes · {secs}s flood · measuring keystroke latency under load\n");

    let sink = Arc::new(Counter {
        bytes: AtomicU64::new(0),
        chunks: AtomicU64::new(0),
    });
    let panes = Arc::new(Panes::default());

    // ---- baseline: one idle pane, no flood anywhere -------------------------
    pty::spawn(sink.clone(), panes.clone(), 0, "cmd", None, &[], 120, 40)?;
    std::thread::sleep(Duration::from_millis(700));

    let mut idle = Vec::new();
    for _ in 0..300 {
        let t = Instant::now();
        pty::write(&panes, 0, "x");
        idle.push(t.elapsed().as_nanos());
        std::thread::sleep(Duration::from_millis(2));
    }
    idle.sort_unstable();
    pty::write(&panes, 0, "\x03\r\n"); // clear the junk we typed

    // ---- load: every pane floods, continuously ------------------------------
    for id in 1..n {
        pty::spawn(sink.clone(), panes.clone(), id, "cmd", None, &[], 120, 40)?;
    }
    std::thread::sleep(Duration::from_millis(900));

    // A tight echo loop is the closest cheap stand-in for an agent dumping a
    // build log: continuous, unbuffered, and faster than a human can read.
    let flood = "for /L %i in (1,1,2000000) do @echo [%i] agentswarm pressure test line with some realistic width to it\r\n";
    for id in 1..n {
        pty::write(&panes, id, flood);
    }

    let start = Instant::now();
    let b0 = sink.bytes.load(Ordering::Relaxed);

    // measure the keystroke path while all the above is screaming
    let mut loaded = Vec::new();
    while start.elapsed() < Duration::from_secs(secs) {
        let t = Instant::now();
        pty::write(&panes, 0, "x");
        loaded.push(t.elapsed().as_nanos());
        std::thread::sleep(Duration::from_millis(2));
    }
    loaded.sort_unstable();

    let elapsed = start.elapsed().as_secs_f64();
    let bytes = sink.bytes.load(Ordering::Relaxed) - b0;
    let chunks = sink.chunks.load(Ordering::Relaxed);

    for id in 1..n {
        pty::write(&panes, id, "\x03");
    }

    let us = |v: u128| v as f64 / 1000.0;
    println!("  throughput while measuring");
    println!("    {:.1} MB in {:.1}s  =  {:.1} MB/s across {} panes",
        bytes as f64 / 1048576.0, elapsed, bytes as f64 / 1048576.0 / elapsed, n - 1);
    println!("    {chunks} chunks emitted\n");

    println!("  keystroke latency (write to PTY)");
    println!("                 idle          under load");
    println!("    p50     {:>8.1} µs     {:>8.1} µs", us(pct(&idle, 0.50)), us(pct(&loaded, 0.50)));
    println!("    p95     {:>8.1} µs     {:>8.1} µs", us(pct(&idle, 0.95)), us(pct(&loaded, 0.95)));
    println!("    p99     {:>8.1} µs     {:>8.1} µs", us(pct(&idle, 0.99)), us(pct(&loaded, 0.99)));
    println!("    max     {:>8.1} µs     {:>8.1} µs",
        us(*idle.last().unwrap()), us(*loaded.last().unwrap()));
    println!("    samples {:>8}       {:>8}\n", idle.len(), loaded.len());

    // A human notices input lag somewhere around 30-50 ms. The invariant is that
    // load does not move this number meaningfully.
    let p99 = us(pct(&loaded, 0.99)) / 1000.0;
    let ratio = us(pct(&loaded, 0.50)).max(0.001) / us(pct(&idle, 0.50)).max(0.001);
    println!("  verdict");
    println!("    p99 under load: {p99:.2} ms  ({})",
        if p99 < 5.0 { "PASS — far below the ~30ms a human can feel" }
        else if p99 < 30.0 { "PASS — under the perception threshold" }
        else { "FAIL — a human would feel this" });
    println!("    p50 load/idle ratio: {ratio:.2}×  ({})\n",
        if ratio < 3.0 { "input path is not contending with output" }
        else { "WARNING — writes are waiting on readers" });

    Ok(())
}
