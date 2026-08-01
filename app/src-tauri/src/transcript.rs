//! M2 — the semantic layer.
//!
//! The pane shows the real terminal. This module reads the *same session* from
//! Claude Code's own JSONL transcript and turns it into structured cards, so the
//! UI can render understanding instead of scraping the screen.
//!
//! Two rules, both learned the hard way:
//!   1. Never parse the rendered terminal. Structure comes from the transcript.
//!   2. The format is undocumented and will drift. Every parse is best-effort and
//!      degrades to "unknown" rather than throwing — a broken card must never
//!      take the terminal down with it.

use serde::Serialize;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

/// One thing that happened, distilled. Deliberately small: the timeline is a
/// summary, and anything richer is one keystroke away in the raw view.
#[derive(Clone, Serialize)]
pub struct Card {
    pub pane: u32,
    pub kind: String,   // "you" | "claude" | "tool" | "result"
    pub title: String,
    pub body: String,
    /// The raw ISO timestamp, not a pre-formatted clock face. The merged
    /// timeline interleaves panes by real time, and "16:33" cannot be ordered
    /// against another session's "16:33". Display formatting is the UI's job.
    pub iso: String,
    /// The tool_use id, carried by both the call and its result. This is what
    /// lets the UI know a tool is still outstanding — and an outstanding tool
    /// with a quiet terminal is a permission prompt nobody has noticed.
    pub id: String,
}

/// M12 — resolve a profile's declared transcript directory.
///
/// The semantic layer used to compute Claude Code's path itself, which
/// hard-wired the feature to one vendor. A profile now declares where its agent
/// writes, and Claude's behaviour is expressed through this same function rather
/// than as an exception in the code — which is the only honest way to know the
/// abstraction actually fits.
///
/// `{home}` · `{cwd}` · `{cwd_slug}` — the last being the working directory with
/// every non-alphanumeric character replaced by a dash, Claude Code's own
/// convention.
pub fn resolve_dir(template: &str, cwd: &str) -> Option<PathBuf> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    let slug: String = cwd
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let filled = template
        .replace("{home}", &home)
        .replace("{cwd_slug}", &slug)
        .replace("{cwd}", cwd);
    if filled.contains('{') {
        return None; // an unknown placeholder is a typo, not a directory
    }
    Some(PathBuf::from(filled))
}

/// Where Claude Code writes, expressed as the default source rather than as a
/// special case.
pub const CLAUDE_DIR: &str = "{home}/.claude/projects/{cwd_slug}";

pub fn project_dir(cwd: &str) -> Option<PathBuf> {
    resolve_dir(CLAUDE_DIR, cwd)
}

/// The newest transcript in that directory, ignoring subagent sidechain files.
fn newest(dir: &PathBuf) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().map(|x| x == "jsonl").unwrap_or(false)
                && !p
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with("agent-"))
                    .unwrap_or(false)
        })
        .max_by_key(|p| {
            std::fs::metadata(p)
                .and_then(|m| m.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH)
        })
}

/// Where to start reading a transcript we did not create. A long-running session
/// can be tens of megabytes; replaying all of it would bury today's work under
/// last week's. Take the recent tail, then stream.
fn tail_start(path: &PathBuf) -> u64 {
    const TAIL: u64 = 256 * 1024;
    let mut pos = std::fs::metadata(path)
        .map(|m| m.len().saturating_sub(TAIL))
        .unwrap_or(0);
    if pos > 0 {
        // we almost certainly landed mid-line; discard the fragment
        if let Ok(f) = std::fs::File::open(path) {
            let mut r = BufReader::new(f);
            if r.seek(SeekFrom::Start(pos)).is_ok() {
                let mut skip = String::new();
                if let Ok(n) = r.read_line(&mut skip) {
                    pos += n as u64;
                }
            }
        }
    }
    pos
}

fn clip(s: &str, n: usize) -> String {
    let s = s.trim().replace(['\r', '\n'], " ");
    if s.chars().count() > n {
        s.chars().take(n).collect::<String>() + "…"
    } else {
        s
    }
}

fn tag<'a>(s: &'a str, name: &str) -> Option<&'a str> {
    let open = format!("<{name}>");
    let close = format!("</{name}>");
    let i = s.find(&open)? + open.len();
    let j = s[i..].find(&close)? + i;
    Some(&s[i..j])
}

/// A slash command is stored as XML-ish tags, so it looks like machinery and is
/// easy to discard as noise. It isn't — it's the user typing. Dropping these
/// silently deletes whole instructions from the record, which is precisely how an
/// earlier pass lost the original pitch for this app.
fn slash_command(text: &str) -> Option<String> {
    let name = tag(text, "command-name")?.trim();
    if name.is_empty() {
        return None;
    }
    let args = tag(text, "command-args").unwrap_or("").trim();
    Some(if args.is_empty() {
        name.to_string()
    } else {
        clip(&format!("{name} {args}"), 400)
    })
}

/// Turn one transcript line into cards — plural, because one message can hold
/// several parallel tool calls, and collapsing those to one would make the
/// outstanding-tool count wrong. An empty result is silent in the timeline but
/// still returned, because it is what closes an outstanding call.
///
/// Anything we do not understand yields nothing, which is the honest answer for
/// an undocumented format.
pub fn parse_line(pane: u32, line: &str) -> Vec<Card> {
    let mut out = Vec::new();
    let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else { return out };
    if v.get("isSidechain").and_then(|b| b.as_bool()).unwrap_or(false) {
        return out;
    }
    let iso = v
        .get("timestamp")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .to_string();
    let Some(msg) = v.get("message") else { return out };
    let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("");
    let Some(content) = msg.get("content") else { return out };

    let card = |kind: &str, title: &str, body: String, id: &str| Card {
        pane,
        kind: kind.into(),
        title: title.into(),
        body,
        iso: iso.clone(),
        id: id.into(),
    };

    // plain string content = a user message
    if let Some(text) = content.as_str() {
        if role != "user" {
            return out;
        }
        if let Some(cmd) = slash_command(text) {
            out.push(card("you", "you", cmd, ""));
        } else if !text.starts_with('<') {
            // a leading '<' means task-notification, caveat, reminder — machinery
            out.push(card("you", "you", clip(text, 400), ""));
        }
        return out;
    }

    let Some(blocks) = content.as_array() else { return out };

    if role == "user" {
        // tool results arrive wearing the user role; they are machine output
        for b in blocks {
            if b.get("type").and_then(|t| t.as_str()) != Some("tool_result") {
                continue;
            }
            let body = b
                .get("content")
                .map(|c| match c.as_str() {
                    Some(s) => s.to_string(),
                    None => c
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|x| x.get("text").and_then(|t| t.as_str()))
                                .collect::<Vec<_>>()
                                .join(" ")
                        })
                        .unwrap_or_default(),
                })
                .unwrap_or_default();
            let id = b.get("tool_use_id").and_then(|i| i.as_str()).unwrap_or("");
            out.push(card("result", "result", clip(&body, 240), id));
        }
        if !out.is_empty() {
            return out;
        }
        let text: String = blocks
            .iter()
            .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
            .collect::<Vec<_>>()
            .join(" ");
        if !text.trim().is_empty() && !text.starts_with('<') {
            out.push(card("you", "you", clip(&text, 400), ""));
        }
        return out;
    }

    if role == "assistant" {
        // in order, so the timeline reads the way the turn actually happened:
        // what it said, then what it did
        for b in blocks {
            match b.get("type").and_then(|t| t.as_str()) {
                Some("text") => {
                    let t = b.get("text").and_then(|t| t.as_str()).unwrap_or("");
                    if !t.trim().is_empty() {
                        out.push(card("claude", "claude", clip(t, 500), ""));
                    }
                }
                Some("tool_use") => {
                    let name = b.get("name").and_then(|n| n.as_str()).unwrap_or("tool");
                    let i = b.get("input");
                    let arg = ["command", "file_path", "pattern", "query", "url", "prompt"]
                        .iter()
                        .find_map(|k| i.and_then(|i| i.get(*k)).and_then(|x| x.as_str()))
                        .unwrap_or("");
                    let id = b.get("id").and_then(|i| i.as_str()).unwrap_or("");
                    out.push(card("tool", name, clip(arg, 200), id));
                }
                _ => {} // thinking, and whatever the format grows next
            }
        }
    }

    out
}

/// M5 — one result from searching everything that has been said in a folder.
///
/// The citation is the point. "You decided this" is worth nothing without
/// *where*, so every hit carries the transcript file and the line number inside
/// it — enough to open the exact record and check.
#[derive(Clone, Serialize)]
pub struct Hit {
    pub session: String,
    pub line: u32,
    pub iso: String,
    pub kind: String,
    pub title: String,
    pub body: String,
    /// Which of the searched folders this came from, so results from several
    /// panes stay tellable apart.
    pub cwd: String,
    /// What was being said immediately before this happened. Empty for a plain
    /// search; filled by `touched_by`, where the reason is the whole point — a
    /// tool call on its own tells you a file was written, not why.
    pub context: String,
}

/// Search every transcript under each folder for a phrase.
///
/// This is the thing the cockpit could not do: answer "what did I decide about
/// this" across sessions that have already ended. Panes are live; transcripts
/// are the memory, and they outlast every pane that wrote them.
///
/// Matching is plain case-insensitive substring. Not fuzzy: when the answer is
/// going to be quoted back with a citation, a hit needs to be a hit.
/// Every transcript file under each folder, newest first, with its folder.
/// Recent decisions are the ones being asked about.
fn transcripts(cwds: &[String]) -> Vec<(String, PathBuf)> {
    let mut out = Vec::new();
    let mut seen: Vec<PathBuf> = Vec::new();
    for cwd in cwds {
        let Some(dir) = project_dir(cwd) else { continue };
        if seen.contains(&dir) {
            continue; // several panes in one folder share a transcript directory
        }
        seen.push(dir.clone());

        let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
            .map(|d| d.filter_map(|e| e.ok()).map(|e| e.path()).collect())
            .unwrap_or_default();
        files.retain(|p| p.extension().map(|e| e == "jsonl").unwrap_or(false));
        files.sort_by_key(|p| {
            std::cmp::Reverse(
                std::fs::metadata(p)
                    .and_then(|m| m.modified())
                    .unwrap_or(SystemTime::UNIX_EPOCH),
            )
        });
        for f in files {
            out.push((cwd.clone(), f));
        }
    }
    out
}

fn file_name(p: &PathBuf) -> String {
    p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
}

/// Tools that write to a file. A pane "touched" a file if one of these named it.
const EDITORS: &[&str] = &["Write", "Edit", "MultiEdit", "NotebookEdit", "Update"];

/// M6 — the conversation that changed a file.
///
/// This is the question a diff cannot answer and a git blame answers badly:
/// *why is this line here.* Every edit in a transcript names the file it wrote,
/// so the edits can be found — and what was being said just before each one is
/// the reason it happened.
///
/// Unlike the live attribution in the cockpit, this reads **all** history, so a
/// file edited in a session that ended last week still has an owner and a reason.
pub fn touched_by(cwds: &[String], path: &str, limit: usize) -> Vec<Hit> {
    // Match on the tail, because a transcript records an absolute path and the
    // caller usually has one relative to the repo root.
    let tail = path.replace('\\', "/").trim_start_matches("./").to_lowercase();
    if tail.is_empty() {
        return Vec::new();
    }

    let mut hits = Vec::new();
    for (cwd, file) in transcripts(cwds) {
        let Ok(text) = std::fs::read_to_string(&file) else { continue };
        let name = file_name(&file);
        // what was being said as we walked; the reason for the edit that follows
        let mut said = String::new();

        for (i, line) in text.lines().enumerate() {
            for c in parse_line(0, line) {
                match c.kind.as_str() {
                    "claude" | "you" => said = c.body.clone(),
                    "tool" if EDITORS.contains(&c.title.as_str()) => {
                        let wrote = c.body.replace('\\', "/").to_lowercase();
                        if wrote.ends_with(&tail) || tail.ends_with(&wrote) {
                            hits.push(Hit {
                                session: name.clone(),
                                line: i as u32 + 1,
                                iso: c.iso.clone(),
                                kind: "tool".into(),
                                title: c.title.clone(),
                                body: c.body.clone(),
                                cwd: cwd.clone(),
                                context: said.clone(),
                            });
                            if hits.len() >= limit {
                                return hits;
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    hits
}

/// Split a query into the words that must all appear. Quoting a phrase keeps it
/// whole: `"permission mode"` matches those two words adjacent, not separately.
fn terms(query: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut quoted = false;
    for ch in query.chars() {
        match ch {
            '"' => {
                quoted = !quoted;
                if !quoted && !cur.trim().is_empty() {
                    out.push(cur.trim().to_lowercase());
                    cur.clear();
                }
            }
            c if c.is_whitespace() && !quoted => {
                if !cur.trim().is_empty() {
                    out.push(cur.trim().to_lowercase());
                    cur.clear();
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_lowercase());
    }
    out
}

pub fn search(cwds: &[String], query: &str, limit: usize) -> Vec<Hit> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Vec::new();
    }

    // Every word must appear, not just one. "permission mode" was matching
    // everything that mentioned either, which buries the answer you wanted under
    // hundreds of near misses — the failure mode that makes a search feel broken
    // even though it is technically working.
    let words = terms(&needle);
    if words.is_empty() {
        return Vec::new();
    }

    let mut hits: Vec<Hit> = Vec::new();
    for (cwd, path) in transcripts(cwds) {
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        let name = file_name(&path);

        for (i, line) in text.lines().enumerate() {
            // cheap reject before the parse — most lines match nothing
            let lower = line.to_lowercase();
            if !words.iter().all(|w| lower.contains(w)) {
                continue;
            }
            for c in parse_line(0, line) {
                let hay = format!("{} {}", c.title, c.body).to_lowercase();
                if !words.iter().all(|w| hay.contains(w)) {
                    continue; // the words were in metadata, not in what was said
                }
                hits.push(Hit {
                    session: name.clone(),
                    line: i as u32 + 1,
                    iso: c.iso,
                    kind: c.kind,
                    title: c.title,
                    body: c.body,
                    cwd: cwd.clone(),
                    context: String::new(),
                });
                if hits.len() >= limit {
                    return hits;
                }
            }
        }
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;

    fn one(line: &str) -> Card {
        let mut v = parse_line(1, line);
        assert_eq!(v.len(), 1, "expected exactly one card from {line}");
        v.remove(0)
    }
    fn none(line: &str) -> bool {
        parse_line(1, line).is_empty()
    }

    #[test]
    fn reads_a_plain_user_turn() {
        let c = one(r#"{"timestamp":"2026-07-31T09:41:02Z","message":{"role":"user","content":"build the thing"}}"#);
        assert_eq!(c.kind, "you");
        assert_eq!(c.body, "build the thing");
        assert_eq!(c.iso, "2026-07-31T09:41:02Z");
        assert_eq!(c.pane, 1);
    }

    #[test]
    fn names_the_tool_and_its_subject() {
        let c = one(r#"{"message":{"role":"assistant","content":[{"type":"tool_use","id":"tu_1","name":"Bash","input":{"command":"cargo test"}}]}}"#);
        assert_eq!(c.kind, "tool");
        assert_eq!(c.title, "Bash");
        assert_eq!(c.body, "cargo test");
        assert_eq!(c.id, "tu_1");
    }

    #[test]
    fn keeps_every_parallel_tool_call() {
        // collapsing these to one would undercount outstanding tools, and the
        // outstanding count is exactly what M3 reads to say "this needs you"
        let v = parse_line(1, r#"{"message":{"role":"assistant","content":[
            {"type":"text","text":"checking both"},
            {"type":"tool_use","id":"a","name":"Read","input":{"file_path":"x.rs"}},
            {"type":"tool_use","id":"b","name":"Grep","input":{"pattern":"fn main"}}]}}"#);
        assert_eq!(v.len(), 3);
        assert_eq!(v[0].kind, "claude");           // said it, then did it — in order
        assert_eq!((v[1].title.as_str(), v[1].id.as_str()), ("Read", "a"));
        assert_eq!((v[2].title.as_str(), v[2].id.as_str()), ("Grep", "b"));
    }

    #[test]
    fn a_result_carries_the_id_of_the_call_it_closes() {
        let v = parse_line(1, r#"{"message":{"role":"user","content":[
            {"type":"tool_result","tool_use_id":"a","content":"ok, 3 passed"},
            {"type":"tool_result","tool_use_id":"b","content":""}]}}"#);
        assert_eq!(v.len(), 2);
        // they arrive wearing the user role; calling them "you" would put words
        // in the user's mouth, which is the exact failure the vault transcripts hit
        assert_eq!(v[0].kind, "result");
        assert_eq!(v[0].id, "a");
        // an empty result is silent in the timeline but must still be returned,
        // or its call stays outstanding forever and the pane lies about needing you
        assert_eq!(v[1].id, "b");
        assert_eq!(v[1].body, "");
    }

    #[test]
    fn ignores_subagent_chatter_and_junk() {
        assert!(none(r#"{"isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}"#));
        assert!(none("not json at all"));
        assert!(none("{}"));
        assert!(none(r#"{"message":{"role":"user","content":"<system-reminder>noise</system-reminder>"}}"#));
        assert!(none(r#"{"message":{"role":"assistant","content":[{"type":"text","text":"   "}]}}"#));
        assert!(none(r#"{"message":{"role":"assistant","content":[{"type":"thinking","thinking":"hmm"}]}}"#));
    }

    #[test]
    fn clips_on_character_boundaries() {
        // byte slicing here would panic on any multi-byte character
        let long = "é".repeat(600);
        let c = one(&format!(r#"{{"message":{{"role":"assistant","content":[{{"type":"text","text":"{long}"}}]}}}}"#));
        assert_eq!(c.body.chars().count(), 501); // 500 + the ellipsis
    }

    #[test]
    fn keeps_slash_commands_but_drops_machinery() {
        // a slash command IS the user talking, even though it is wrapped in tags
        let c = one(r#"{"message":{"role":"user","content":"<command-message>office-hours</command-message>\n<command-name>/office-hours</command-name>\n<command-args>plan the cockpit</command-args>"}}"#);
        assert_eq!(c.kind, "you");
        assert_eq!(c.body, "/office-hours plan the cockpit");

        // a command with no arguments still counts
        assert_eq!(one(r#"{"message":{"role":"user","content":"<command-name>/clear</command-name>"}}"#).body, "/clear");

        // genuine machinery still goes in the bin
        assert!(none(r#"{"message":{"role":"user","content":"<task-notification><task-id>x</task-id></task-notification>"}}"#));
        assert!(none(r#"{"message":{"role":"user","content":"<command-name>  </command-name>"}}"#));
        assert!(none(r#"{"message":{"role":"user","content":"<command-name>unclosed"}}"#));
    }

    #[test]
    fn a_query_splits_into_words_that_must_all_appear() {
        assert_eq!(terms("permission mode"), vec!["permission", "mode"]);
        assert_eq!(terms("  spaced   out  "), vec!["spaced", "out"]);
        // a quoted phrase stays whole, so it matches adjacent words only
        assert_eq!(terms("\"permission mode\""), vec!["permission mode"]);
        assert_eq!(terms("why \"child session\" broke"), vec!["why", "child session", "broke"]);
        // an unclosed quote is still a usable phrase rather than an error
        assert_eq!(terms("\"unclosed phrase"), vec!["unclosed phrase"]);
        assert!(terms("   ").is_empty());
    }

    #[test]
    fn claudes_own_path_comes_out_of_the_general_mechanism() {
        // M12. The abstraction is only real if the built-in case goes through it.
        // If `project_dir` still computed its own path, a second agent would be
        // a second special case rather than a second configuration.
        let via_default = project_dir("E:\\agent-swarm").unwrap();
        let via_template = resolve_dir(CLAUDE_DIR, "E:\\agent-swarm").unwrap();
        assert_eq!(via_default, via_template);
        assert!(via_default.ends_with("E--agent-swarm"), "got {via_default:?}");
    }

    #[test]
    fn a_profile_can_point_somewhere_else_entirely() {
        // what a non-Claude agent's declaration looks like
        let d = resolve_dir("{cwd}/.sessions", "E:\\work").unwrap();
        assert!(d.to_string_lossy().contains(".sessions"));
        assert!(d.to_string_lossy().contains("work"));

        // {home} resolves, and the slug is available separately from the raw cwd
        let h = resolve_dir("{home}/agent/{cwd_slug}", "E:\\a b").unwrap();
        assert!(h.to_string_lossy().ends_with("E--a-b"), "got {h:?}");

        // a typo is not silently treated as a literal directory name
        assert!(resolve_dir("{hme}/x", "E:\\a").is_none());
    }

    #[test]
    fn maps_a_windows_path_to_its_project_dir() {
        let d = project_dir("E:\\agent-swarm").unwrap();
        assert!(d.ends_with("E--agent-swarm"), "got {d:?}");
    }
}

/// Watch the transcript belonging to a pane and stream cards as they appear.
/// Runs until the pane is gone; every failure is soft.
/// `on_status` is called with a human-readable line and whether the transcript we
/// settled on is **this pane's own session**. That flag is not cosmetic: while we
/// are merely catching up on somebody else's transcript, its outstanding tool
/// calls say nothing about this pane, and treating them as if they did produces
/// confident false alarms.
pub fn watch<F: Fn(Card) + Send + 'static, S: Fn(&str, bool) + Send + 'static>(
    pane: u32,
    dir: PathBuf,
    format: String,
    started: SystemTime,
    on_card: F,
    on_status: S,
) {
    std::thread::spawn(move || {
        // Only one format is parsed. Anything else is reported as unreadable
        // rather than guessed at — a wrong reading of somebody's session is
        // worse than no reading, and this is the layer that must never invent.
        if format != "claude-jsonl" {
            on_status(&format!("no reader for {format} sessions"), false);
            return;
        }

        // Attach to the newest transcript straight away so the pane has context
        // immediately, then switch to this pane's own session the moment it
        // starts writing.
        //
        // The first version instead waited for a *recently modified* file, which
        // sounds right and is wrong: a session that is running but idle has an old
        // mtime, so the common case — attach to work already in progress — never
        // attached at all. It reported nothing and looked like a dead feature.
        let mut path: Option<PathBuf> = None;
        let mut pos: u64 = 0;
        let mut locked = false; // found this pane's own session; stop switching
        let mut waited = 0u32;

        loop {
            if !locked {
                if let Some(p) = newest(&dir) {
                    let ours = std::fs::metadata(&p)
                        .and_then(|m| m.created().or_else(|_| m.modified()))
                        .map(|t| t >= started)
                        .unwrap_or(false);
                    if path.as_ref() != Some(&p) {
                        // Our own session is short and worth replaying whole.
                        // An older one is prior context: show only its tail.
                        pos = if ours { 0 } else { tail_start(&p) };
                        on_status(
                            &format!(
                                "{} {}",
                                if ours { "following" } else { "catching up on" },
                                p.file_name().unwrap_or_default().to_string_lossy()
                            ),
                            ours,
                        );
                        path = Some(p);
                    }
                    locked = ours;
                } else if waited == 0 {
                    on_status("no claude session in this folder yet", false);
                }
            }
            waited += 1;

            let Some(path) = path.as_ref() else {
                std::thread::sleep(Duration::from_millis(500));
                continue;
            };
            let Ok(f) = std::fs::File::open(path) else { break };
            let len = f.metadata().map(|m| m.len()).unwrap_or(0);
            if len < pos {
                pos = 0; // file was replaced under us
            }
            if len > pos {
                let mut r = BufReader::new(f);
                if r.seek(SeekFrom::Start(pos)).is_ok() {
                    let mut line = String::new();
                    loop {
                        line.clear();
                        match r.read_line(&mut line) {
                            Ok(0) => break,
                            Ok(n) => {
                                pos += n as u64;
                                // a partial trailing line: rewind and wait for the rest
                                if !line.ends_with('\n') {
                                    pos -= n as u64;
                                    break;
                                }
                                for c in parse_line(pane, &line) {
                                    on_card(c);
                                }
                            }
                            Err(_) => break,
                        }
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(400));
        }
    });
}
