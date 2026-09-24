#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn sync_board_state(state: String) -> Result<(), String> {
    let dir = dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("MoodBored");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("board.json"), state).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_board_state() -> Result<String, String> {
    let path = dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("MoodBored")
        .join("board.json");
    if path.exists() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync_board_state, read_board_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
