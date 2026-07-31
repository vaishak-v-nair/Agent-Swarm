pub mod pty;
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
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty::spawn(
        Arc::new(WebviewSink(app)),
        state.panes.clone(),
        id,
        &profile,
        cwd,
        cols,
        rows,
    )
    .map_err(|e| e.to_string())
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
        move |text| {
            let _ = a2.emit("sem:status", Status { pane: id, text: text.to_string() });
        },
    );
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
            diag
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentSwarm");
}
