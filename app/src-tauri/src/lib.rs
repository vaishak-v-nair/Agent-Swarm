pub mod adapter;
pub mod attention;
pub mod doctor;
pub mod event;
pub mod git;
pub mod project;
pub mod pty;
pub mod recipes;
pub mod session;
pub mod settings;
pub mod steer;
pub mod store;
pub mod transcript;

use pty::{Panes, Sink};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, Serialize)]
struct Chunk<'a> {
    id: u32,
    data: &'a str,
}

#[derive(Clone, Serialize)]
struct Exit {
    id: u32,
}

#[derive(Clone, Serialize)]
struct Status {
    pane: u32,
    text: String,
    /// True once we are following this pane's *own* session. Until then the
    /// cards are context from an earlier session, and must not be used to judge
    /// whether this pane is waiting on you.
    own: bool,
}

/// The app's sink: PTY bytes become webview events.
///
/// The emit is fire-and-forget by design — a rendering problem must never stall
/// the reader thread, because the reader holds no lock the writer needs and that
/// is the whole reason typing stays instant under load.
struct WebviewSink {
    app: AppHandle,
    store: Arc<store::EventStore>,
}

impl Sink for WebviewSink {
    fn data(&self, id: u32, text: &str) {
        if text.contains('\x07') {
            let evt = event::AgentEvent::new(
                id,
                event::EventKind::Bell,
                format!("pane {id} terminal bell rung"),
                serde_json::json!({ "pane_id": id }),
                false,
            );
            let _ = self.store.insert(&evt);
            let _ = self.app.emit("agent:event", &evt);
        }
        let _ = self.app.emit("pty:data", Chunk { id, data: text });
    }
    fn exit(&self, id: u32) {
        let evt = event::AgentEvent::new(
            id,
            event::EventKind::ProcessExit,
            format!("pane {id} exited"),
            serde_json::json!({ "pane_id": id }),
            false,
        );
        let _ = self.store.insert(&evt);
        let _ = self.app.emit("agent:event", &evt);
        let _ = self.app.emit("pty:exit", Exit { id });
    }
}

pub struct AppState {
    pub panes: Arc<Panes>,
    pub store: Arc<store::EventStore>,
    pub session_token: String,
    pub session_mgr: Arc<session::SessionManager>,
}

#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    state: State<AppState>,
    id: u32,
    profile: String,
    cwd: Option<String>,
    args: Option<Vec<String>>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // A profile the user defined wins over a built-in of the same name, so a
    // settings file can correct anything this binary got wrong about a command.
    let here = cwd.clone().unwrap_or_else(|| ".".into());
    let defined = settings::load(&here).settings.profiles.remove(&profile);
    let custom = defined.as_ref().map(|d| pty::Custom {
        command: &d.command,
        args: &d.args,
        keep_open: d.keep_open,
    });
    pty::spawn(
        Arc::new(WebviewSink {
            app,
            store: state.store.clone(),
        }),
        state.panes.clone(),
        id,
        &profile,
        cwd,
        &args.unwrap_or_default(),
        custom,
        cols,
        rows,
    )
    .map_err(|e| e.to_string())
}

/// M4. The named swarms available from this folder.
#[tauri::command]
async fn list_recipes(cwd: String) -> recipes::Loaded {
    recipes::load(&cwd)
}

/// A swarm named on the command line: `agentswarm --swarm morning`.
///
/// The milestone's exit test is "the morning swarm is one command", and this is
/// what makes that sentence literally true rather than nearly true — a shortcut
/// or a shell alias opens the whole arrangement, with no keystrokes after it.
#[tauri::command]
fn startup_swarm() -> Option<String> {
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        if a == "--swarm" {
            return args.next();
        }
        if let Some(v) = a.strip_prefix("--swarm=") {
            return Some(v.to_string());
        }
    }
    None
}

/// `--demo`: the app drives its own UI on a timer so a recording shows work
/// happening. Driving from outside needs the window focused, and focus belongs
/// to whoever is using the machine.
#[tauri::command]
fn demo_requested() -> bool {
    std::env::args().skip(1).any(|a| a == "--demo")
}

/// Keep the swarm currently on screen, under a name. Arranging panes by hand and
/// then saving beats authoring JSON for a layout you have not tried yet.
#[tauri::command]
fn save_recipe(cwd: String, recipe: recipes::Recipe) -> Result<String, String> {
    recipes::save(&cwd, recipe).map(|p| p.to_string_lossy().to_string())
}

/// M8. Give a first run something to find. Returns the path if one was written.
#[tauri::command]
fn seed_first_run(cwd: String) -> Option<String> {
    recipes::seed_if_absent(&cwd, &available_profiles(Some(cwd.clone())))
}

/// M8. What this is and where it keeps things, for the about entry.
#[tauri::command]
fn about() -> serde_json::Value {
    let cwd = std::env::current_dir().unwrap_or_default();
    // Paths are built here, with PathBuf, and never assembled from separators in
    // a JavaScript string literal. Backslashes in JS literals have been mangled
    // repeatedly in this codebase — an escaped separator is a bug waiting to
    // happen, and the side that owns paths should hand over finished ones.
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "cwd": cwd.to_string_lossy(),
        "config_dir": cwd.join(".agentswarm").to_string_lossy(),
        "transcripts": transcript::project_dir(&cwd.to_string_lossy())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
    })
}

/// A terminal without copy and paste is not a terminal. Both go through Rust
/// rather than the webview clipboard API, which needs permissions WebView2 does
/// not reliably grant. Async: clipboard access can block on another app holding
/// the clipboard open, and the UI thread must never wait on that.
#[tauri::command]
async fn clip_write(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .and_then(|mut c| c.set_text(text))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clip_read() -> Result<String, String> {
    arboard::Clipboard::new()
        .and_then(|mut c| c.get_text())
        .map_err(|e| e.to_string())
}

/// Is this something we are willing to hand to the OS as a URL?
///
/// Terminal output is untrusted by definition — an agent might print anything.
/// Only http(s), no whitespace or quotes, bounded length. `file://` and
/// `javascript:` are exactly the schemes a hostile string would want.
fn url_ok(u: &str) -> bool {
    (u.starts_with("https://") || u.starts_with("http://"))
        && u.len() > 10
        && u.len() < 2048
        && !u.chars().any(|c| c.is_whitespace() || matches!(c, '"' | '\'' | '<' | '>' | '`'))
}

/// Open a link from the terminal in the default browser.
///
/// rundll32 receives the URL as an argument — no shell, so nothing in the
/// string is ever parsed as a command. `cmd /C start` would be, which is how a
/// printed `&` becomes an executed one.
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    if !url_ok(&url) {
        return Err(format!("refusing to open: {url}"));
    }
    std::process::Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Scalar settings from the in-app sheet. Everything the form does not know
/// about — profiles above all — survives, because the write goes through
/// settings::update rather than serializing the form.
#[tauri::command]
async fn save_settings(
    cwd: String,
    quiet_ms: u64,
    stuck_ms: u64,
    burst_floor: u64,
    scrollback: u32,
    feed_max: u32,
    restore_layout: bool,
    layout: String,
) -> Result<String, String> {
    settings::update(&cwd, |s| {
        s.quiet_ms = quiet_ms;
        s.stuck_ms = stuck_ms;
        s.burst_floor = burst_floor;
        s.scrollback = scrollback;
        s.feed_max = feed_max;
        s.restore_layout = restore_layout;
        if layout == "stage" || layout == "grid" {
            s.layout = layout;
        }
    })
}

/// M7. The thresholds, and where they came from.
#[tauri::command]
async fn load_settings(cwd: String) -> settings::Loaded {
    settings::load(&cwd)
}

/// M7. Put a settings file on disk to edit. Nobody tunes a file they must invent.
#[tauri::command]
fn write_settings_template(cwd: String) -> Result<String, String> {
    settings::write_template(&cwd)
}

/// M7. Remember what was open. Written on every change, not on exit — a crash
/// never reaches an exit handler, and that is exactly when you want it back.
#[tauri::command]
fn save_layout(cwd: String, panes: Vec<recipes::RecipePane>) -> Result<(), String> {
    recipes::save_layout(&cwd, panes)
}

#[tauri::command]
fn load_layout(cwd: String) -> Vec<recipes::RecipePane> {
    recipes::load_layout(&cwd)
}

/// Async so it never runs on the main thread.
///
/// Tauri runs a synchronous command on the UI thread. Every heavy command here
/// was synchronous, so reading 21.5 MB of transcripts or shelling out to git
/// froze the window — which Windows reports, correctly, as "not responding".
/// Nothing was slow enough to notice in a benchmark and everything was slow
/// enough to stall a repaint.
///
/// M5. What is different in the working tree for a pane's folder.
#[tauri::command]
async fn git_changes(cwd: String) -> git::Changes {
    git::changes(&cwd)
}

/// M5. The unified diff for one file.
#[tauri::command]
async fn git_file_diff(cwd: String, path: String, untracked: bool) -> String {
    git::file_diff(&cwd, &path, untracked)
}

/// M5. Search everything that has been said in these folders.
///
/// The cockpit shows live panes. This reaches sessions that have already ended,
/// which is the only way to answer "what did I decide about this yesterday" —
/// and every hit carries the transcript file and line, so the answer can be
/// checked rather than believed.
#[tauri::command]
async fn search_history(cwds: Vec<String>, query: String, limit: Option<usize>) -> Vec<transcript::Hit> {
    transcript::search(&cwds, &query, limit.unwrap_or(60))
}

/// M6. The conversation that changed a file.
///
/// A diff says what is different. This says why — the edits that produced it and
/// what was being said just before each one, across all history rather than only
/// the sessions this app happened to have open.
#[tauri::command]
async fn file_history(cwds: Vec<String>, path: String, limit: Option<usize>) -> Vec<transcript::Hit> {
    transcript::touched_by(&cwds, &path, limit.unwrap_or(40))
}

/// M2. Attach the semantic layer to a pane: watch the Claude Code transcript for
/// this folder and stream structured cards alongside the raw terminal.
///
/// This is separate from pty_spawn on purpose. The terminal must work whether or
/// not the semantic layer does — understanding is an addition, never a dependency.
#[tauri::command]
fn sem_attach(
    app: AppHandle,
    state: State<AppState>,
    id: u32,
    cwd: String,
    profile: Option<String>,
) {
    let name = profile.unwrap_or_default();
    let declared = settings::load(&cwd).settings.profiles.remove(&name).and_then(|p| p.transcript);

    let (template, format) = match declared {
        Some(t) => (t.dir, t.format),
        None if name == "claude" => (transcript::CLAUDE_DIR.to_string(), "claude-jsonl".to_string()),
        None => {
            let _ = app.emit("sem:status", Status {
                pane: id,
                text: format!("{name} keeps no session record — raw output only"),
                own: false,
            });
            return;
        }
    };

    let Some(dir) = transcript::resolve_dir(&template, &cwd) else {
        let _ = app.emit("sem:status", Status {
            pane: id,
            text: format!("cannot resolve transcript directory \"{template}\""),
            own: false,
        });
        return;
    };

    let a1 = app.clone();
    let a2 = app.clone();
    let store1 = state.store.clone();
    transcript::watch(
        id,
        dir,
        format,
        std::time::SystemTime::now(),
        move |card| {
            let title = if card.title.is_empty() {
                card.body.chars().take(80).collect()
            } else {
                card.title.clone()
            };
            let evt = event::AgentEvent::new(
                id,
                if card.kind == "tool" {
                    event::EventKind::ToolCall
                } else if card.kind == "error" {
                    event::EventKind::ErrorLoop
                } else {
                    event::EventKind::PromptInput
                },
                title,
                serde_json::to_value(&card).unwrap_or(serde_json::Value::Null),
                card.kind == "error",
            );
            let _ = store1.insert(&evt);
            let _ = a1.emit("agent:event", &evt);
            let _ = a1.emit("sem:card", card);
        },
        move |text, own| {
            let _ = a2.emit("sem:status", Status { pane: id, text: text.to_string(), own });
        },
    );
}

/// M3. Carry the cockpit's state out to the operating system.
///
/// The window title is the part that works when AgentSwarm isn't the window you
/// are looking at — which is the entire problem: an agent asked for permission,
/// you were somewhere else, and twelve minutes went by. Taskbar attention is
/// requested only on the transition into needing you, and only when the window
/// is not already focused; anything more insistent than that becomes noise, and
/// noise is what people learn to ignore.
#[tauri::command]
fn set_attention(app: AppHandle, title: String, flash: bool) {
    use tauri::Manager;
    let Some(w) = app.get_webview_window("main") else { return };
    let _ = w.set_title(&title);
    if flash && !w.is_focused().unwrap_or(false) {
        let _ = w.request_user_attention(Some(tauri::UserAttentionType::Informational));
    }
}

/// Where a pane starts, and therefore which transcript belongs to it.
#[tauri::command]
fn default_cwd() -> String {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
fn pty_write(state: State<AppState>, id: u32, data: String) {
    pty::write(&state.panes, id, &data);
}

#[tauri::command]
fn pty_resize(state: State<AppState>, id: u32, cols: u16, rows: u16) {
    pty::resize(&state.panes, id, cols, rows);
}

#[tauri::command]
fn pty_kill(state: State<AppState>, id: u32) {
    pty::kill(&state.panes, id);
}

/// Which shells actually exist on this machine. The UI asks once at startup and
/// only offers real ones — a profile that fails to launch is worse than absent.
/// The UI talking to stdout. Without this a frontend failure is invisible
/// unless a human is looking at the window.
#[tauri::command]
fn diag(msg: String) {
    println!("[ui] {msg}");
}

#[tauri::command]
fn available_profiles(cwd: Option<String>) -> Vec<String> {
    let mut out = vec!["powershell".to_string(), "cmd".to_string()];
    for (bin, name) in [("pwsh.exe", "pwsh"), ("wsl.exe", "wsl"), ("claude", "claude")] {
        if which(bin) {
            out.push(name.to_string());
        }
    }
    // Profiles from settings, but only the ones this machine can actually run —
    // offering a command that is not installed is how a menu starts lying.
    if let Some(cwd) = cwd {
        for (name, p) in settings::load(&cwd).settings.profiles {
            if !out.contains(&name) && which(&p.command) {
                out.push(name);
            }
        }
    }
    out
}

#[tauri::command]
fn event_emit(
    app: AppHandle,
    state: State<AppState>,
    pane_id: u32,
    kind: String,
    summary: String,
    data: Option<serde_json::Value>,
    is_error: Option<bool>,
) -> Result<event::AgentEvent, String> {
    let parsed_kind = kind.parse().map_err(|e: String| e)?;
    let evt = event::AgentEvent::new(
        pane_id,
        parsed_kind,
        summary,
        data.unwrap_or(serde_json::Value::Null),
        is_error.unwrap_or(false),
    );
    let _ = state.store.insert(&evt);
    let _ = app.emit("agent:event", &evt);
    Ok(evt)
}

#[tauri::command]
fn event_query(
    state: State<AppState>,
    pane_id: Option<u32>,
    limit: Option<usize>,
) -> Result<Vec<event::AgentEvent>, String> {
    let lim = limit.unwrap_or(50);
    if let Some(pid) = pane_id {
        state.store.query_by_pane(pid, lim).map_err(|e| e.to_string())
    } else {
        state.store.query_recent(lim).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn event_query_errors(
    state: State<AppState>,
    limit: Option<usize>,
) -> Result<Vec<event::AgentEvent>, String> {
    state.store.query_errors(limit.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_session_token(state: State<AppState>) -> String {
    state.session_token.clone()
}

#[tauri::command]
fn steer_pane(
    state: State<AppState>,
    token: String,
    pane_id: u32,
    action: String,
    payload: String,
) -> steer::SteerResponse {
    let req = steer::SteerRequest {
        token,
        pane_id,
        action,
        payload,
    };
    steer::execute_steer(&state.panes, req, &state.session_token)
}

#[tauri::command]
fn get_attention_queue(
    state: State<AppState>,
    pane_ids: Vec<u32>,
) -> Vec<attention::AttentionItem> {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    attention::AttentionScorer::rank_panes(&pane_ids, &state.store, now_ms)
}

#[tauri::command]
fn list_projects(cwd: Option<String>) -> Vec<project::Project> {
    let here = cwd.unwrap_or_else(default_cwd);
    project::ProjectRegistry::list(&here)
}

#[tauri::command]
fn add_project(path: String) -> project::Project {
    project::ProjectRegistry::add(&path)
}

#[tauri::command]
fn list_agent_adapters() -> Vec<adapter::AdapterInfo> {
    adapter::AdapterRegistry::detect_all()
}

#[tauri::command]
fn list_sessions(state: State<AppState>) -> Vec<session::AgentSession> {
    state.session_mgr.list()
}

#[tauri::command]
fn create_task_session(
    state: State<AppState>,
    project_id: String,
    task_title: String,
    agent_type: String,
    pane_id: u32,
    cwd: String,
    branch: Option<String>,
) -> session::AgentSession {
    state.session_mgr.create(project_id, task_title, agent_type, pane_id, cwd, branch)
}

#[tauri::command]
fn update_session_status(
    state: State<AppState>,
    pane_id: u32,
    status: String,
    reason: String,
    score: u32,
) -> Option<session::AgentSession> {
    let stat = match status.as_str() {
        "starting" => session::SessionStatus::Starting,
        "working" => session::SessionStatus::Working,
        "needs_attention" => session::SessionStatus::NeedsAttention,
        "completed" => session::SessionStatus::Completed,
        "failed" => session::SessionStatus::Failed,
        "paused" => session::SessionStatus::Paused,
        _ => session::SessionStatus::Working,
    };
    state.session_mgr.update_status(pane_id, stat, reason, score)
}

#[tauri::command]
async fn run_verification(cwd: String, command: Option<String>) -> Result<String, String> {
    let cmd_str = command.unwrap_or_else(|| {
        project::Project::from_path(&cwd)
            .default_test_command
            .unwrap_or_else(|| "npm test".to_string())
    });

    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
    if parts.is_empty() {
        return Err("empty verification command".into());
    }

    let program = parts[0];
    let args = &parts[1..];

    let out = std::process::Command::new(program)
        .current_dir(&cwd)
        .args(args)
        .output()
        .map_err(|e| format!("failed to execute {cmd_str}: {e}"))?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let combined = format!("{stdout}\n{stderr}");

    if out.status.success() {
        Ok(combined)
    } else {
        Err(format!("Verification failed with status {}:\n{combined}", out.status))
    }
}

fn get_event_store_path() -> std::path::PathBuf {
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        let dir = std::path::PathBuf::from(base).join("agentswarm");
        let _ = std::fs::create_dir_all(&dir);
        dir.join("events.db")
    } else {
        std::path::PathBuf::from("events.db")
    }
}

fn write_session_token(token: &str) {
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        let dir = std::path::PathBuf::from(base).join("agentswarm");
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(dir.join("session.token"), token);
    }
}

fn which(bin: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|dir| {
                let p = dir.join(bin);
                p.is_file()
                    || ["exe", "cmd", "bat"]
                        .iter()
                        .any(|e| dir.join(format!("{bin}.{e}")).is_file())
            })
        })
        .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Everything this process spawns dies with it — the X button, a crash, a
    // Stop-Process -Force, all of them. Without this, each pane's headless
    // conhost.exe outlived the app, hung, and Windows raised a "stopped
    // responding" dialog per pane. Multiple panes meant multiple error dialogs,
    // which is exactly what got reported. A Job Object with kill-on-close is
    // the Windows-correct answer: the OS does the cleanup, so it works even
    // when we never get the chance to.
    if let Ok(job) = win32job::Job::create() {
        let ok = job
            .query_extended_limit_info()
            .map(|mut info| {
                info.limit_kill_on_job_close();
                job.set_extended_limit_info(&mut info).is_ok() && job.assign_current_process().is_ok()
            })
            .unwrap_or(false);
        if ok {
            std::mem::forget(job); // the handle must live as long as the process
        } else {
            eprintln!("[rust] job object setup failed — pane processes may outlive the app");
        }
    }

    // A panic with panic=abort dies as a bare WER dialog and leaves nothing to
    // debug. Write what happened somewhere doctor can find it first.
    std::panic::set_hook(Box::new(|info| {
        if let Ok(base) = std::env::var("LOCALAPPDATA") {
            let dir = std::path::PathBuf::from(base).join("agentswarm");
            let _ = std::fs::create_dir_all(&dir);
            let _ = std::fs::write(
                dir.join("panic.log"),
                format!("{}
{info}
", chrono_free_timestamp()),
            );
        }
    }));

    // --doctor prints and exits. No window: it has to work when the window is
    // exactly what is broken, and the smoke test calls it before driving the UI.
    if doctor::requested() {
        let cwd = doctor::cwd_or_here();
        let ok = doctor::print(&cwd.to_string_lossy());
        std::process::exit(if ok { 0 } else { 1 });
    }

    tauri::Builder::default()
        .setup(|app| {
            let panes = Arc::new(Panes::default());
            let session_token = uuid::Uuid::new_v4().simple().to_string();
            write_session_token(&session_token);

            let store_path = get_event_store_path();
            let store = Arc::new(store::EventStore::open(&store_path).unwrap_or_else(|e| {
                eprintln!("[store] falling back to in-memory event store: {e}");
                store::EventStore::in_memory().expect("in-memory event store")
            }));

            let session_mgr = Arc::new(session::SessionManager::new());

            app.manage(AppState {
                panes,
                store,
                session_token,
                session_mgr,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            available_profiles,
            sem_attach,
            default_cwd,
            list_recipes,
            save_recipe,
            git_changes,
            git_file_diff,
            search_history,
            file_history,
            seed_first_run,
            about,
            load_settings,
            save_settings,
            clip_write,
            clip_read,
            open_url,
            write_settings_template,
            save_layout,
            load_layout,
            startup_swarm,
            demo_requested,
            set_attention,
            diag,
            event_emit,
            event_query,
            event_query_errors,
            get_session_token,
            steer_pane,
            get_attention_queue,
            list_projects,
            add_project,
            list_agent_adapters,
            list_sessions,
            create_task_session,
            update_session_status,
            run_verification
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentSwarm");
}

/// Seconds since the epoch — enough to date a crash without a chrono dep.
fn chrono_free_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| format!("unix {}", d.as_secs()))
        .unwrap_or_default()
}

#[cfg(test)]
mod lib_tests {
    use super::url_ok;

    #[test]
    fn only_plain_web_urls_are_opened() {
        assert!(url_ok("https://github.com/yc-software/qm"));
        assert!(url_ok("http://localhost:1420/harness.html"));
        // terminal output is untrusted; these are the strings that matter
        assert!(!url_ok("file:///C:/Windows/System32/calc.exe"));
        assert!(!url_ok("javascript:alert(1)"));
        assert!(!url_ok("https://x.com/a b"));            // whitespace
        assert!(!url_ok("https://x.com/\"quote"));         // quote
        assert!(!url_ok(""));
        assert!(!url_ok(&("https://x.com/".to_string() + &"a".repeat(3000))));
    }
}
