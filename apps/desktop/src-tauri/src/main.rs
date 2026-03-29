#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

struct Sidecar(Mutex<Option<Child>>);

fn start_backend() -> Option<Child> {
    // Try bundled executable first, then fall back to python
    let exe = if cfg!(windows) {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("suitagent-api.exe")))
    } else {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("suitagent-api")))
    };

    if let Some(ref path) = exe {
        if path.exists() {
            return Command::new(path).spawn().ok();
        }
    }

    // Fallback: run via python
    Command::new("python")
        .args(["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"])
        .spawn()
        .ok()
}

fn wait_for_backend(timeout_secs: u64) -> bool {
    let client = reqwest::blocking::Client::new();
    let deadline = std::time::Instant::now() + Duration::from_secs(timeout_secs);

    while std::time::Instant::now() < deadline {
        if client.get("http://127.0.0.1:8000/api/cases").send().is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    false
}

fn main() {
    let child = start_backend();

    if child.is_some() {
        wait_for_backend(15);
    }

    tauri::Builder::default()
        .manage(Sidecar(Mutex::new(child)))
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Backend cleanup handled by Drop
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

impl Drop for Sidecar {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
            }
        }
    }
}
