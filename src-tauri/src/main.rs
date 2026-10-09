#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::process::{Command, Child};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::State;

// ─── Server State ───────────────────────────────────────────────────

struct ServerState {
    child: Mutex<Option<Child>>,
}

// ─── Data Types ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChromeTab {
    title: String,
    url: String,
    #[serde(rename = "favIconUrl")]
    fav_icon_url: Option<String>,
    pinned: bool,
    index: i32,
    #[serde(rename = "windowId")]
    window_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct BoardNode {
    id: String,
    viewport_id: String,
    kind: String,
    data: String, // JSON
    x: f64,
    y: f64,
    created: String,
    updated: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct BoardEdge {
    id: String,
    viewport_id: String,
    from_id: String,
    from_port_id: String,
    to_id: String,
    to_port_id: String,
    connection_type: String,
    label: String,
    owner: String,
    created: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct BoardSnapshot {
    id: String,
    name: String,
    description: String,
    project: String, // JSON
    created: String,
    tags: String, // JSON array
}

#[derive(Debug, Serialize, Deserialize)]
struct BoardWorkspace {
    id: String,
    name: String,
    description: String,
    project: String, // JSON
    snapshots: String, // JSON
    created: String,
    updated: String,
    pinned: bool,
}

// ─── Database State ──────────────────────────────────────────────────

struct DbState {
    conn: Mutex<Connection>,
}

fn get_db_path() -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("MoodBored")
}

fn init_db(conn: &Connection) {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            viewport_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            data TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            created TEXT NOT NULL,
            updated TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_nodes_viewport ON nodes(viewport_id);
        CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);

        CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY,
            viewport_id TEXT NOT NULL,
            from_id TEXT NOT NULL,
            from_port_id TEXT NOT NULL,
            to_id TEXT NOT NULL,
            to_port_id TEXT NOT NULL,
            connection_type TEXT NOT NULL DEFAULT 'related',
            label TEXT DEFAULT '',
            owner TEXT NOT NULL DEFAULT 'user',
            created TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_edges_viewport ON edges(viewport_id);
        CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
        CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);

        CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            project TEXT NOT NULL,
            created TEXT NOT NULL,
            tags TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            project TEXT NOT NULL,
            snapshots TEXT DEFAULT '[]',
            created TEXT NOT NULL,
            updated TEXT NOT NULL,
            pinned INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS action_history (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            action TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_project ON action_history(project_id);

        CREATE TABLE IF NOT EXISTS cookies (
            item_id TEXT PRIMARY KEY,
            cookies TEXT NOT NULL DEFAULT ''
        );
    ").expect("Failed to initialize database");
}

// ─── Board State Commands (existing) ─────────────────────────────────

#[tauri::command]
fn sync_board_state(state: String) -> Result<(), String> {
    let dir = get_db_path();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("board.json"), state).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_board_state() -> Result<String, String> {
    let path = get_db_path().join("board.json");
    if path.exists() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

// ─── Node Commands ───────────────────────────────────────────────────

#[tauri::command]
fn save_node(db: State<DbState>, node: BoardNode) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO nodes (id, viewport_id, kind, data, x, y, created, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![node.id, node.viewport_id, node.kind, node.data, node.x, node.y, node.created, node.updated],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_node(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM nodes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_nodes(db: State<DbState>, viewport_id: String) -> Result<Vec<BoardNode>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, viewport_id, kind, data, x, y, created, updated FROM nodes WHERE viewport_id = ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![viewport_id], |row| {
        Ok(BoardNode {
            id: row.get(0)?,
            viewport_id: row.get(1)?,
            kind: row.get(2)?,
            data: row.get(3)?,
            x: row.get(4)?,
            y: row.get(5)?,
            created: row.get(6)?,
            updated: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();
    for row in rows {
        nodes.push(row.map_err(|e| e.to_string())?);
    }
    Ok(nodes)
}

// ─── Edge Commands ───────────────────────────────────────────────────

#[tauri::command]
fn save_edge(db: State<DbState>, edge: BoardEdge) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO edges (id, viewport_id, from_id, from_port_id, to_id, to_port_id, connection_type, label, owner, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![edge.id, edge.viewport_id, edge.from_id, edge.from_port_id, edge.to_id, edge.to_port_id, edge.connection_type, edge.label, edge.owner, edge.created],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_edge(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM edges WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_edges(db: State<DbState>, viewport_id: String) -> Result<Vec<BoardEdge>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, viewport_id, from_id, from_port_id, to_id, to_port_id, connection_type, label, owner, created FROM edges WHERE viewport_id = ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![viewport_id], |row| {
        Ok(BoardEdge {
            id: row.get(0)?,
            viewport_id: row.get(1)?,
            from_id: row.get(2)?,
            from_port_id: row.get(3)?,
            to_id: row.get(4)?,
            to_port_id: row.get(5)?,
            connection_type: row.get(6)?,
            label: row.get(7)?,
            owner: row.get(8)?,
            created: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut edges = Vec::new();
    for row in rows {
        edges.push(row.map_err(|e| e.to_string())?);
    }
    Ok(edges)
}

// ─── Snapshot Commands ───────────────────────────────────────────────

#[tauri::command]
fn save_snapshot(db: State<DbState>, snapshot: BoardSnapshot) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO snapshots (id, name, description, project, created, tags) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![snapshot.id, snapshot.name, snapshot.description, snapshot.project, snapshot.created, snapshot.tags],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_snapshot(db: State<DbState>, id: String) -> Result<Option<BoardSnapshot>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, project, created, tags FROM snapshots WHERE id = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(BoardSnapshot {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            project: row.get(3)?,
            created: row.get(4)?,
            tags: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

#[tauri::command]
fn list_snapshots(db: State<DbState>) -> Result<Vec<BoardSnapshot>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, project, created, tags FROM snapshots ORDER BY created DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(BoardSnapshot {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            project: row.get(3)?,
            created: row.get(4)?,
            tags: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut snapshots = Vec::new();
    for row in rows {
        snapshots.push(row.map_err(|e| e.to_string())?);
    }
    Ok(snapshots)
}

#[tauri::command]
fn delete_snapshot(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM snapshots WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Workspace Commands ──────────────────────────────────────────────

#[tauri::command]
fn save_workspace(db: State<DbState>, workspace: BoardWorkspace) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO workspaces (id, name, description, project, snapshots, created, updated, pinned) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![workspace.id, workspace.name, workspace.description, workspace.project, workspace.snapshots, workspace.created, workspace.updated, workspace.pinned],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_workspace(db: State<DbState>, id: String) -> Result<Option<BoardWorkspace>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, project, snapshots, created, updated, pinned FROM workspaces WHERE id = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(BoardWorkspace {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            project: row.get(3)?,
            snapshots: row.get(4)?,
            created: row.get(5)?,
            updated: row.get(6)?,
            pinned: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

#[tauri::command]
fn list_workspaces(db: State<DbState>) -> Result<Vec<BoardWorkspace>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, description, project, snapshots, created, updated, pinned FROM workspaces ORDER BY pinned DESC, updated DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(BoardWorkspace {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            project: row.get(3)?,
            snapshots: row.get(4)?,
            created: row.get(5)?,
            updated: row.get(6)?,
            pinned: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    let mut workspaces = Vec::new();
    for row in rows {
        workspaces.push(row.map_err(|e| e.to_string())?);
    }
    Ok(workspaces)
}

#[tauri::command]
fn delete_workspace(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Cookie Commands ─────────────────────────────────────────────────

#[tauri::command]
fn get_cookies(db: State<DbState>, item_id: String) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT cookies FROM cookies WHERE item_id = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![item_id], |row| {
        Ok(row.get::<_, String>(0)?)
    }).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(row) => Ok(row.map_err(|e| e.to_string())?),
        None => Ok(String::new()),
    }
}

#[tauri::command]
fn set_cookies(db: State<DbState>, item_id: String, cookies: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO cookies (item_id, cookies) VALUES (?1, ?2)",
        params![item_id, cookies],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Chrome Import ───────────────────────────────────────────────────

#[tauri::command]
fn get_chrome_tabs() -> Result<Vec<ChromeTab>, String> {
    // Try to connect to Chrome's debugging port
    // Default Chrome DevTools Protocol port is 9222
    let output = std::process::Command::new("curl")
        .args(["-s", "http://localhost:9222/json/list"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let json_str = String::from_utf8_lossy(&out.stdout);
            let tabs: Vec<serde_json::Value> = serde_json::from_str(&json_str)
                .map_err(|e| format!("Failed to parse Chrome tabs: {}", e))?;

            let chrome_tabs: Vec<ChromeTab> = tabs.iter().enumerate().map(|(i, tab)| {
                ChromeTab {
                    title: tab["title"].as_str().unwrap_or("").to_string(),
                    url: tab["url"].as_str().unwrap_or("").to_string(),
                    fav_icon_url: tab["favIconUrl"].as_str().map(|s| s.to_string()),
                    pinned: tab["pinned"].as_bool().unwrap_or(false),
                    index: i as i32,
                    window_id: tab["windowId"].as_i64().unwrap_or(1) as i32,
                }
            }).collect();

            Ok(chrome_tabs)
        }
        _ => {
            // Chrome debugging not available, return empty
            Err("Chrome DevTools Protocol not available. Enable it by launching Chrome with --remote-debugging-port=9222".to_string())
        }
    }
}

// ─── Action History ──────────────────────────────────────────────────

#[tauri::command]
fn log_action(db: State<DbState>, project_id: String, action: String, data: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = format!("{}-{}", chrono_now(), uuid_simple());
    conn.execute(
        "INSERT INTO action_history (id, project_id, action, data, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, project_id, action, data, chrono_now()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_action_history(db: State<DbState>, project_id: String, limit: i32) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT data FROM action_history WHERE project_id = ?1 ORDER BY timestamp DESC LIMIT ?2").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![project_id, limit], |row| {
        Ok(row.get::<_, String>(0)?)
    }).map_err(|e| e.to_string())?;
    let mut actions = Vec::new();
    for row in rows {
        actions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(actions)
}

// ─── Helpers ─────────────────────────────────────────────────────────

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{}", duration.as_millis())
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}", duration.as_nanos())
}

// ─── Server Commands ─────────────────────────────────────────────────

#[tauri::command]
fn start_server(state: State<ServerState>) -> Result<String, String> {
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;

    // Check if server is already running
    if let Some(ref mut child) = *child_guard {
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process exited, restart it
            }
            Ok(None) => {
                return Ok("Server is already running".to_string());
            }
            Err(e) => {
                return Err(format!("Failed to check server status: {}", e));
            }
        }
    }

    // Get the path to server.mjs
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe_path.parent().ok_or("Failed to get exe directory")?;

    // Try to find server.mjs in various locations
    let server_paths = vec![
        exe_dir.join("server.mjs"),
        exe_dir.join("..").join("server.mjs"),
        exe_dir.join("..").join("..").join("server.mjs"),
        PathBuf::from("server.mjs"),
    ];

    let mut server_path = None;
    for path in &server_paths {
        if path.exists() {
            server_path = Some(path.clone());
            break;
        }
    }

    let server_path = server_path.ok_or("Could not find server.mjs")?;

    // Start the server
    let child = Command::new("node")
        .arg(server_path.to_str().ok_or("Invalid path")?)
        .env("PORT", "3000")
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    *child_guard = Some(child);
    Ok("Server started on port 3000".to_string())
}

#[tauri::command]
fn stop_server(state: State<ServerState>) -> Result<String, String> {
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut child) = *child_guard {
        child.kill().map_err(|e| e.to_string())?;
        *child_guard = None;
        Ok("Server stopped".to_string())
    } else {
        Ok("Server is not running".to_string())
    }
}

#[tauri::command]
fn get_server_status(state: State<ServerState>) -> Result<String, String> {
    let child_guard = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(ref _child) = *child_guard {
        // Try to check if the server is responding
        let client = reqwest::blocking::Client::new();
        match client.get("http://localhost:3000/api/board/health").timeout(std::time::Duration::from_secs(2)).send() {
            Ok(resp) => {
                if resp.status().is_success() {
                    Ok("running".to_string())
                } else {
                    Ok("starting".to_string())
                }
            }
            Err(_) => Ok("not_responding".to_string())
        }
    } else {
        Ok("stopped".to_string())
    }
}

// ─── Main ────────────────────────────────────────────────────────────

fn main() {
    let db_dir = get_db_path();
    fs::create_dir_all(&db_dir).expect("Failed to create data directory");
    let db_path = db_dir.join("moodbored.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn);

    tauri::Builder::default()
        .manage(DbState { conn: Mutex::new(conn) })
        .manage(ServerState { child: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![
            sync_board_state,
            read_board_state,
            save_node,
            delete_node,
            get_nodes,
            save_edge,
            delete_edge,
            get_edges,
            save_snapshot,
            get_snapshot,
            list_snapshots,
            delete_snapshot,
            save_workspace,
            get_workspace,
            list_workspaces,
            delete_workspace,
            get_cookies,
            set_cookies,
            get_chrome_tabs,
            log_action,
            get_action_history,
            start_server,
            stop_server,
            get_server_status,
        ])
        .setup(|_app| {
            // Start the server on app launch in a background thread
            // Use current working directory (where exe is launched from)
            let work_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

            // Also try exe directory
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| work_dir.clone());

            println!("Working directory: {:?}", work_dir);
            println!("Exe directory: {:?}", exe_dir);

            std::thread::spawn(move || {
                // Try multiple locations for server.mjs
                let server_paths = vec![
                    work_dir.join("server.mjs"),
                    exe_dir.join("server.mjs"),
                    PathBuf::from("server.mjs"),
                ];

                let mut server_path = None;
                for path in &server_paths {
                    println!("Checking: {:?}", path);
                    if path.exists() {
                        server_path = Some(path.clone());
                        println!("Found server.mjs at: {:?}", path);
                        break;
                    }
                }

                if let Some(server_path) = server_path {
                    println!("Starting server from: {:?}", server_path);
                    match Command::new("node")
                        .arg(server_path.to_str().unwrap())
                        .env("PORT", "3000")
                        .spawn()
                    {
                        Ok(_child) => {
                            println!("MoodBored server started on port 3000");
                            // Wait for server to be ready
                            for i in 0..30 {
                                std::thread::sleep(std::time::Duration::from_millis(500));
                                if std::net::TcpStream::connect("127.0.0.1:3000").is_ok() {
                                    println!("Server is ready after {}ms", (i + 1) * 500);
                                    break;
                                }
                            }
                        }
                        Err(e) => eprintln!("Failed to start server: {}", e),
                    }
                } else {
                    eprintln!("Could not find server.mjs in any location");
                    eprintln!("Searched: {:?}", server_paths);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}