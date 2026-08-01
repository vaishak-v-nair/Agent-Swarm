//! `agentswarm --doctor` — does this install actually work?
//!
//! Written because the app was shipped with a documented command that did not
//! exist. `agentswarm` was never on anyone's PATH, and the first thing that
//! happened to the first person who followed the instructions was
//! CommandNotFoundException. Nothing in the app could have told them why.
//!
//! Every check answers a question someone would otherwise have to ask a person:
//! is it installed, can it find an agent, can it read sessions, is git here,
//! is the config valid. It prints and exits — no window, so it is also what the
//! smoke test calls to assert the environment before driving the UI.

use crate::{recipes, settings, transcript};
use std::path::PathBuf;

pub struct Check {
    pub ok: bool,
    pub name: &'static str,
    pub detail: String,
    /// What to do about it. Empty when there is nothing to do.
    pub fix: String,
}

fn ok(name: &'static str, detail: impl Into<String>) -> Check {
    Check { ok: true, name, detail: detail.into(), fix: String::new() }
}
fn bad(name: &'static str, detail: impl Into<String>, fix: impl Into<String>) -> Check {
    Check { ok: false, name, detail: detail.into(), fix: fix.into() }
}

fn on_path(bin: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|dir| {
                dir.join(bin).is_file()
                    || ["exe", "cmd", "bat"].iter().any(|e| dir.join(format!("{bin}.{e}")).is_file())
            })
        })
        .unwrap_or(false)
}

/// Every check, in the order a person hits them.
pub fn run(cwd: &str) -> Vec<Check> {
    let mut out = Vec::new();

    // 1. The bug that started this. Is the command itself reachable?
    out.push(if on_path("agentswarm") {
        ok("command", "agentswarm is on your PATH")
    } else {
        bad(
            "command",
            "agentswarm is not on your PATH",
            "powershell -ExecutionPolicy Bypass -File scripts\\add-to-path.ps1",
        )
    });

    // 2. Is there an agent to run? A terminal with no agent is just a terminal.
    let agents: Vec<&str> = ["claude", "codex", "opencode", "pi"]
        .into_iter()
        .filter(|a| on_path(a))
        .collect();
    out.push(if agents.is_empty() {
        bad(
            "agents",
            "no agent CLI found (looked for claude, codex, opencode, pi)",
            "install one, or add a profile in .agentswarm/settings.json",
        )
    } else {
        ok("agents", format!("found {}", agents.join(", ")))
    });

    // 3. Can the semantic layer read anything? This is the feature that quietly
    //    does nothing when the directory is wrong, so it is worth stating.
    match transcript::project_dir(cwd) {
        Some(d) if d.is_dir() => {
            let n = std::fs::read_dir(&d)
                .map(|r| r.filter_map(|e| e.ok()).filter(|e| e.path().extension().map(|x| x == "jsonl").unwrap_or(false)).count())
                .unwrap_or(0);
            out.push(ok("sessions", format!("{n} transcript(s) in {}", d.display())));
        }
        Some(d) => out.push(bad(
            "sessions",
            format!("no transcripts yet at {}", d.display()),
            "run an agent in this folder once; plain english fills in after that",
        )),
        None => out.push(bad("sessions", "cannot resolve a home directory", "set USERPROFILE or HOME")),
    }

    // 4. Config the user wrote. A broken file used to fail silently.
    let loaded = recipes::load(cwd);
    out.push(if loaded.problems.is_empty() {
        ok("swarms", format!("{} defined", loaded.recipes.len()))
    } else {
        bad("swarms", loaded.problems.join("; "), "fix the JSON, or delete the file to start over")
    });

    let s = settings::load(cwd);
    out.push(if s.problem.is_empty() {
        ok("settings", if s.source == "defaults" { "defaults".into() } else { s.source.clone() })
    } else {
        bad("settings", s.problem.clone(), "fix the JSON; defaults are in use until you do")
    });

    // 5. Changes and why need git. Their absence is a missing feature, not a crash.
    out.push(if on_path("git") {
        let repo = std::process::Command::new("git")
            .current_dir(cwd)
            .args(["rev-parse", "--is-inside-work-tree"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if repo {
            ok("git", "this folder is a repository")
        } else {
            bad("git", "not a git repository", "ctrl+shift+D (changes) needs one; everything else works")
        }
    } else {
        bad("git", "git is not installed", "install git; changes and why need it, nothing else does")
    });

    // 6. The env trap that disabled transcripts and history for every pane.
    let nested = std::env::var_os("CLAUDE_CODE_CHILD_SESSION").is_some()
        || std::env::var_os("CLAUDECODE").is_some();
    out.push(if nested {
        ok("environment", "launched from inside an agent session; panes get a clean one")
    } else {
        ok("environment", "clean")
    });

    // 7. Did a previous run die badly? The panic hook writes here, so a crash
    //    that showed the user only a Windows dialog leaves something readable.
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        let f = std::path::PathBuf::from(base).join("agentswarm").join("panic.log");
        match std::fs::read_to_string(&f) {
            Ok(text) if !text.trim().is_empty() => out.push(bad(
                "last crash",
                text.lines().nth(1).unwrap_or("a previous run panicked").to_string(),
                format!("details in {} — delete it to clear this warning", f.display()),
            )),
            _ => out.push(ok("last crash", "none recorded")),
        }
    }

    out
}

/// Print, and return true when everything passed.
pub fn print(cwd: &str) -> bool {
    let checks = run(cwd);
    let all_ok = checks.iter().all(|c| c.ok);

    println!("agentswarm {}  ·  {cwd}\n", env!("CARGO_PKG_VERSION"));
    for c in &checks {
        println!("  {}  {:<12} {}", if c.ok { "ok  " } else { "FAIL" }, c.name, c.detail);
        if !c.fix.is_empty() {
            println!("      {}", c.fix);
        }
    }
    let failed = checks.iter().filter(|c| !c.ok).count();
    println!(
        "\n{}",
        if all_ok {
            "everything checks out".to_string()
        } else {
            format!("{failed} problem(s) above")
        }
    );
    all_ok
}

/// `--doctor` anywhere in argv.
pub fn requested() -> bool {
    std::env::args().skip(1).any(|a| a == "--doctor" || a == "doctor")
}

pub fn cwd_or_here() -> PathBuf {
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_failing_check_tells_you_what_to_do() {
        // A check that reports a problem without a fix is a check that makes
        // someone go and ask a person — which is the thing this file exists to
        // stop. This is the property, not the specific checks.
        for c in run(env!("CARGO_MANIFEST_DIR")) {
            if !c.ok {
                assert!(!c.fix.is_empty(), "check '{}' failed with no fix offered", c.name);
            }
            assert!(!c.detail.is_empty(), "check '{}' said nothing", c.name);
        }
    }

    #[test]
    fn it_reports_on_every_dimension_someone_would_ask_about() {
        let names: Vec<&str> = run(env!("CARGO_MANIFEST_DIR")).iter().map(|c| c.name).collect();
        for expected in ["command", "agents", "sessions", "swarms", "settings", "git", "environment"] {
            assert!(names.contains(&expected), "doctor never checked {expected}");
        }
    }
}
