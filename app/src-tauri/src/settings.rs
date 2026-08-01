//! M7 — the numbers you are allowed to change.
//!
//! M3's state machine decides when to interrupt someone, using thresholds I
//! picked by watching one machine for forty seconds. The build log said plainly
//! that if "waiting" ever fires falsely the number to change is `BURST_FLOOR` —
//! which was useless advice, because changing it meant editing source and
//! rebuilding.
//!
//! The baseline week is running now. If the app cries wolf on Tuesday, that has
//! to be fixable on Tuesday, by the person it lied to.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn d_quiet() -> u64 { 2000 }
fn d_stuck() -> u64 { 8000 }
fn d_floor() -> u64 { 800 }
fn d_scrollback() -> u32 { 10_000 }
fn d_feed() -> u32 { 2000 }
fn d_restore() -> bool { true }
/// Stage by default: one readable terminal beats nine unreadable ones.
fn d_layout() -> String { "stage".into() }

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Below the throughput floor this long, a pane stops counting as working.
    pub quiet_ms: u64,
    /// An outstanding tool plus no real output for this long reads as
    /// "waiting on you". Raise it if the app accuses you during slow tools.
    pub stuck_ms: u64,
    /// Decayed bytes that count as progress rather than an idle repaint.
    pub burst_floor: u64,
    pub scrollback: u32,
    /// How many cards the merged timeline keeps.
    pub feed_max: u32,
    /// Reopen the panes that were open last time, when no swarm was named.
    pub restore_layout: bool,
    /// "stage" — one pane at reading size, the rest as live cards.
    /// "grid"  — every pane tiled evenly.
    pub layout: String,
    /// M11 — profiles you define yourself, by name.
    ///
    /// AgentSwarm shipped knowing five commands and nothing else, which quietly
    /// asserted that a pane runs Claude Code. YC open-sourcing QM — a harness
    /// where Pi, OpenCode, Codex and Claude Code all drive the same core — makes
    /// that assumption look like the limitation it is. The cockpit is about
    /// running several agents at once; it should not care which agent.
    #[serde(default)]
    pub profiles: std::collections::BTreeMap<String, Profile>,
}

/// A command a pane can run.
#[derive(Clone, Serialize, Deserialize)]
pub struct Profile {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    /// Run inside a shell that stays open, so the pane survives the agent
    /// exiting. This is what `claude` already does, and what you want for any
    /// tool you might quit and restart without losing the pane.
    #[serde(default = "yes")]
    pub keep_open: bool,
}

fn yes() -> bool { true }

impl Default for Settings {
    fn default() -> Self {
        Self {
            quiet_ms: d_quiet(),
            stuck_ms: d_stuck(),
            burst_floor: d_floor(),
            scrollback: d_scrollback(),
            feed_max: d_feed(),
            restore_layout: d_restore(),
            layout: d_layout(),
            profiles: Default::default(),
        }
    }
}

#[derive(Serialize)]
pub struct Loaded {
    pub settings: Settings,
    /// Where the values came from, so a surprising threshold is traceable.
    pub source: String,
    pub problem: String,
}

fn project_file(cwd: &str) -> PathBuf {
    PathBuf::from(cwd).join(".agentswarm").join("settings.json")
}

fn home_file() -> Option<PathBuf> {
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).ok()?;
    Some(PathBuf::from(home).join(".agentswarm").join("settings.json"))
}

/// Project settings win over home settings, which win over the defaults —
/// the same order recipes resolve in, because the same reasoning applies.
pub fn load(cwd: &str) -> Loaded {
    for path in [Some(project_file(cwd)), home_file()].into_iter().flatten() {
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        return match serde_json::from_str::<Settings>(&text) {
            Ok(s) => Loaded { settings: s, source: path.display().to_string(), problem: String::new() },
            // A broken settings file falls back to defaults rather than to
            // nothing, and says so. Silently running on numbers the user did not
            // choose is exactly the failure this file exists to let them fix.
            Err(e) => Loaded {
                settings: Settings::default(),
                source: "defaults".into(),
                problem: format!("{} — line {}: {} (using defaults)", path.display(), e.line(), e),
            },
        };
    }
    Loaded { settings: Settings::default(), source: "defaults".into(), problem: String::new() }
}

/// Write the current values out so there is something to edit. Nobody tunes a
/// file they have to invent from scratch.
pub fn write_template(cwd: &str) -> Result<String, String> {
    let path = project_file(cwd);
    let dir = path.parent().ok_or("no parent directory")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    if path.exists() {
        return Ok(path.display().to_string()); // never clobber tuning already done
    }
    let text = serde_json::to_string_pretty(&Settings::default()).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_partial_file_keeps_the_defaults_for_everything_else() {
        // the common case: someone changes one threshold and expects the rest to
        // keep working, not to reset to zero
        let s: Settings = serde_json::from_str(r#"{"stuck_ms": 20000}"#).unwrap();
        assert_eq!(s.stuck_ms, 20_000);
        assert_eq!(s.burst_floor, d_floor());
        assert_eq!(s.scrollback, d_scrollback());
        assert!(s.restore_layout);
        assert_eq!(s.layout, "stage");
        assert!(s.profiles.is_empty());
    }

    #[test]
    fn a_profile_defined_in_settings_is_read_whole() {
        // M11 — the cockpit should not care which agent a pane runs. YC's QM
        // makes the point: Pi, OpenCode, Codex and Claude Code all drive the
        // same core, so a terminal that only knows `claude` is the limitation.
        let s: Settings = serde_json::from_str(r#"{"profiles":{
            "qm": {"command":"qm","args":["run"]},
            "codex": {"command":"codex","keep_open":false}}}"#).unwrap();
        assert_eq!(s.profiles.len(), 2);
        assert_eq!(s.profiles["qm"].command, "qm");
        assert_eq!(s.profiles["qm"].args, vec!["run"]);
        assert!(s.profiles["qm"].keep_open, "a pane should outlive its agent by default");
        assert!(!s.profiles["codex"].keep_open);
        // and the rest of the file still has its defaults
        assert_eq!(s.stuck_ms, d_stuck());
    }

    #[test]
    fn a_broken_file_falls_back_and_explains() {
        let dir = std::env::temp_dir().join("agentswarm-settings-bad");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".agentswarm")).unwrap();
        std::fs::write(dir.join(".agentswarm").join("settings.json"), "{ not json").unwrap();

        let l = load(&dir.to_string_lossy());
        assert_eq!(l.settings.stuck_ms, d_stuck(), "must fall back, not zero out");
        assert!(l.problem.contains("line"), "and must say why: {}", l.problem);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_template_is_never_written_over_tuning_already_done() {
        let dir = std::env::temp_dir().join("agentswarm-settings-keep");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let cwd = dir.to_string_lossy().to_string();

        write_template(&cwd).unwrap();
        std::fs::write(project_file(&cwd), r#"{"stuck_ms": 60000}"#).unwrap();
        write_template(&cwd).unwrap();

        assert_eq!(load(&cwd).settings.stuck_ms, 60_000);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
