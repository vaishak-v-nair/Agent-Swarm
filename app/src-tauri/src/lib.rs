pub mod git;
pub mod pty;
pub mod recipes;
pub mod settings;
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
struct WebviewSink(AppHandle);

impl Sink for WebviewSink {
    fn data(&self, id: u32, text: &str) {
        let _ = self.0.emit("pty:data", Chunk { id, data: text });
    }
    fn exit(&self, id: u32) {
        let _ = self.0.emit("pty:exit", Exit { id });
    }
}

struct AppState {
    panes: Arc<Panes>,
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
    pty::spawn(
        Arc::new(WebviewSink(app)),
        state.panes.clone(),
        id,
        &profile,
        cwd,
        &args.unwrap_or_default(),
        cols,
        rows,
    )
    .map_err(|e| e.to_string())
}

/// M4. The named swarms available from this folder.
#[tauri::command]
fn list_recipes(cwd: String) -> recipes::Loaded {
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

/// Keep the swarm currently on screen, under a name. Arranging panes by hand and
/// then saving beats authoring JSON for a layout you have not tried yet.
#[tauri::command]
fn save_recipe(cwd: String, recipe: recipes::Recipe) -> Result<String, String> {
    recipes::save(&cwd, recipe).map(|p| p.to_string_lossy().to_string())
}

/// M8. Give a first run something to find. Returns the path if one was written.
#[tauri::command]
fn seed_first_run(cwd: String) -> Option<String> {
    recipes::seed_if_absent(&cwd, &available_profiles())
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

/// M7. The thresholds, and where they came from.
#[tauri::command]
fn load_settings(cwd: String) -> settings::Loaded {
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

/// M5. What is different in the working tree for a pane's folder.
#[tauri::command]
fn git_changes(cwd: String) -> git::Changes {
    git::changes(&cwd)
}

/// M5. The unified diff for one file.
#[tauri::command]
fn git_file_diff(cwd: String, path: String, untracked: bool) -> String {
    git::file_diff(&cwd, &path, untracked)
}

/// M5. Search everything that has been said in these folders.
///
/// The cockpit shows live panes. This reaches sessions that have already ended,
/// which is the only way to answer "what did I decide about this yesterday" —
/// and every hit carries the transcript file and line, so the answer can be
/// checked rather than believed.
#[tauri::command]
fn search_history(cwds: Vec<String>, query: String, limit: Option<usize>) -> Vec<transcript::Hit> {
    transcript::search(&cwds, &query, limit.unwrap_or(60))
}

/// M6. The conversation that changed a file.
///
/// A diff says what is different. This says why — the edits that produced it and
/// what was being said just before each one, across all history rather than only
/// the sessions this app happened to have open.
#[tauri::command]
fn file_history(cwds: Vec<String>, path: String, limit: Option<usize>) -> Vec<transcript::Hit> {
    transcript::touched_by(&cwds, &path, limit.unwrap_or(40))
}

/// M2. Attach the semantic layer to a pane: watch the Claude Code transcript for
/// this folder and stream structured cards alongside the raw terminal.
///
/// This is separate from pty_spawn on purpose. The terminal must work whether or
/// not the semantic layer does — understanding is an addition, never a dependency.
#[tauri::command]
fn sem_attach(app: AppHandle, id: u32, cwd: String) {
    let a1 = app.clone();
    let a2 = app.clone();
    transcript::watch(
        id,
        cwd,
        std::time::SystemTime::now(),
        move |card| {
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
fn available_profiles() -> Vec<String> {
    let mut out = vec!["powershell".to_string(), "cmd".to_string()];
    for (bin, name) in [("pwsh.exe", "pwsh"), ("wsl.exe", "wsl"), ("claude", "claude")] {
        if which(bin) {
            out.push(name.to_string());
        }
    }
    out
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
    tauri::Builder::default()
        .setup(|app| {
            app.manage(AppState {
                panes: Arc::new(Panes::default()),
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
            write_settings_template,
            save_layout,
            load_layout,
            startup_swarm,
            set_attention,
            diag
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentSwarm");
}
