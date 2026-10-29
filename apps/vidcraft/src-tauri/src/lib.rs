//! VidCraft Tauri shell. Thin layer: receives IPC calls from the React frontend
//! and dispatches them into the FilmCraft engine's command registry and the
//! gflow-cli bridge.
//!
//! Keep this crate thin. Real editing logic lives in `filmcraft-engine` and in
//! the future `vidcraft-flow-bridge`, `vidcraft-rush-agent`, `vidcraft-mcd-bridge`
//! crates — not here.

mod export;
mod flow;

use serde::Serialize;

/// Smoke-test return type for the first IPC call: proves the frontend can reach
/// the backend AND that the backend links against `filmcraft-engine`.
#[derive(Serialize)]
struct EngineInfo {
    engine: &'static str,
    linked: bool,
    note: &'static str,
}

#[tauri::command]
fn engine_info() -> EngineInfo {
    let _marker: Option<filmcraft_engine::Session> = None;
    EngineInfo {
        engine: "filmcraft-engine",
        linked: true,
        note: "VidCraft shell is talking to the FilmCraft engine.",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            engine_info,
            flow::gflow_status,
            flow::gflow_auth_login,
            flow::gflow_generate_video,
            export::ffmpeg_probe,
            export::export_sequence,
        ])
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("vidcraft: tauri runtime exited with error: {err}");
        std::process::exit(1);
    }
}
