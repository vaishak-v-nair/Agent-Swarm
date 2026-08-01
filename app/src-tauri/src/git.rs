//! M5 — what actually changed on disk.
//!
//! The cockpit could say what an agent *said* it did. It could not say what is
//! different in the working tree, which is the question you have when three
//! sessions have been editing the same repo — the R dimension in the baseline
//! log, "which session touched what".
//!
//! Nothing here parses porcelain that git does not promise. `--porcelain` and
//! `--numstat` are the two stable, machine-readable formats, and a repo that is
//! not a repo, or a git that is not installed, degrades to an empty list with a
//! reason rather than an error the terminal has to survive.

use serde::Serialize;
use std::process::Command;

#[derive(Clone, Serialize)]
pub struct Change {
    pub path: String,
    /// Two-letter porcelain code: "M ", " M", "??", "A ", "D " …
    pub status: String,
    pub added: u32,
    pub removed: u32,
    /// True for files git is not tracking yet, which have no diff to count.
    pub untracked: bool,
}

#[derive(Default, Serialize)]
pub struct Changes {
    pub root: String,
    pub branch: String,
    pub files: Vec<Change>,
    /// Empty when everything worked. Never a thrown error — a repo problem must
    /// not be able to take a terminal down.
    pub problem: String,
}

fn git(cwd: &str, args: &[&str]) -> Option<String> {
    let out = Command::new("git").current_dir(cwd).args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).to_string())
}

/// Everything different in the working tree, with line counts.
pub fn changes(cwd: &str) -> Changes {
    let mut c = Changes::default();

    let Some(root) = git(cwd, &["rev-parse", "--show-toplevel"]) else {
        c.problem = "not a git repository (or git is not installed)".into();
        return c;
    };
    c.root = root.trim().to_string();
    c.branch = git(cwd, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    // numstat first: tracked files, with real line counts
    let mut counts: Vec<(String, u32, u32)> = Vec::new();
    for spec in [vec!["diff", "--numstat"], vec!["diff", "--numstat", "--cached"]] {
        let Some(text) = git(cwd, &spec) else { continue };
        for line in text.lines() {
            let mut parts = line.split('\t');
            let (a, d, p) = (parts.next(), parts.next(), parts.next());
            let (Some(a), Some(d), Some(p)) = (a, d, p) else { continue };
            // "-" means binary; count it as zero rather than guessing
            let added = a.parse().unwrap_or(0);
            let removed = d.parse().unwrap_or(0);
            match counts.iter_mut().find(|(f, _, _)| f == p) {
                Some(e) => { e.1 += added; e.2 += removed; }
                None => counts.push((p.to_string(), added, removed)),
            }
        }
    }

    let Some(status) = git(cwd, &["status", "--porcelain"]) else {
        c.problem = "git status failed".into();
        return c;
    };
    for line in status.lines() {
        if line.len() < 4 {
            continue;
        }
        let code = &line[..2];
        // porcelain quotes paths containing unusual characters; keep them whole
        let path = line[3..].trim_matches('"').to_string();
        // a rename reads "old -> new"; the new name is the one you can open
        let path = path.rsplit(" -> ").next().unwrap_or(&path).to_string();
        let (added, removed) = counts
            .iter()
            .find(|(f, _, _)| *f == path)
            .map(|(_, a, r)| (*a, *r))
            .unwrap_or((0, 0));
        c.files.push(Change {
            untracked: code == "??",
            status: code.to_string(),
            path,
            added,
            removed,
        });
    }

    // biggest edits first — that is the order you triage in
    c.files.sort_by_key(|f| std::cmp::Reverse(f.added + f.removed));
    c
}

/// The unified diff for one file, bounded so a generated file cannot flood the UI.
pub fn file_diff(cwd: &str, path: &str, untracked: bool) -> String {
    let text = if untracked {
        // /dev/null works on Windows git too; it is git's own convention
        git(cwd, &["diff", "--no-index", "--", "/dev/null", path])
            .or_else(|| std::fs::read_to_string(std::path::Path::new(cwd).join(path)).ok())
    } else {
        git(cwd, &["diff", "HEAD", "--", path]).or_else(|| git(cwd, &["diff", "--", path]))
    };

    let text = text.unwrap_or_else(|| "(no diff available)".into());
    const MAX: usize = 4000;
    if text.lines().count() > MAX {
        let head: Vec<&str> = text.lines().take(MAX).collect();
        format!("{}\n… truncated at {MAX} lines", head.join("\n"))
    } else {
        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_folder_that_is_not_a_repo_reports_why() {
        let dir = std::env::temp_dir().join("agentswarm-not-a-repo");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let c = changes(&dir.to_string_lossy());
        assert!(c.files.is_empty());
        assert!(!c.problem.is_empty(), "a non-repo must say so, not look clean");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reads_this_repo() {
        // the repo this test runs in is a real one; the point is that it parses
        let c = changes(env!("CARGO_MANIFEST_DIR"));
        assert!(c.problem.is_empty(), "{}", c.problem);
        assert!(!c.root.is_empty());
        // every reported file has a usable path
        for f in &c.files {
            assert!(!f.path.is_empty());
            assert_eq!(f.status.len(), 2, "porcelain codes are two columns");
        }
    }
}
