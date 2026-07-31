pub mod pty;

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

/// The app's sink: PTY bytes become webview events.
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
            available_profiles
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentSwarm");
}
