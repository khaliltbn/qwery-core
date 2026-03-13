use std::path::PathBuf;
use tauri::Manager;

fn target_triple() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin";
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc";
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "aarch64-unknown-linux-gnu";
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu";
    #[allow(unreachable_code)]
    "aarch64-apple-darwin" // fallback
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let resource_dir = app.path()
                .resolve("", tauri::path::BaseDirectory::Resource)
                .expect("failed to resolve resource dir");
            let node_modules_path = resource_dir.join("node_modules");
            let extensions_dir = if cfg!(debug_assertions) {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("target")
                    .join("debug")
                    .join("extensions")
            } else {
                resource_dir.join("extensions")
            };

            println!("Node modules path: {}", node_modules_path.to_str().unwrap());

            let target = target_triple();
            let api_server_name = format!("api-server-{}", target);
            let bun_name = format!("bun-{}", target);
            let (bun_path, api_server_path): (PathBuf, PathBuf) = if cfg!(debug_assertions) {
                let binaries = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
                (binaries.join(&bun_name), binaries.join(&api_server_name))
            } else {
                let binaries = resource_dir.join("binaries");
                (binaries.join(&bun_name), binaries.join(&api_server_name))
            };

            let storage_dir = app
                .path()
                .home_dir()
                .expect("failed to resolve home dir")
                .join(".qwery")
                .join("storage");

            // In dev, load from source tree. In prod, load from ~/.qwery/.env (user-editable on all platforms).
            #[cfg(debug_assertions)]
            let env_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join(".env");
            #[cfg(not(debug_assertions))]
            let env_path = app
                .path()
                .home_dir()
                .expect("failed to resolve home dir")
                .join(".qwery")
                .join(".env");
            let _ = dotenvy::from_path(env_path);

            let _child = std::process::Command::new(&bun_path)
                .arg(&api_server_path)
                .envs(std::env::vars_os())
                .env("QWERY_STORAGE_DIR", storage_dir.to_str().expect("storage path"))
                .env(
                    "QWERY_EXTENSIONS_PATH",
                    extensions_dir.to_str().expect("extensions path"),
                )
                .env("VITE_QWERY_RUNTIME", "DESKTOP")
                .env("LOGGER", "pino")
                .spawn()
                .expect("Failed to spawn API server");

            // Wait for server to be ready by checking if port is listening
            tauri::async_runtime::spawn(async move {
                use std::net::TcpStream;
                use std::time::Duration;
                
                let max_attempts = 30;
                let delay_ms = 200;

                for attempt in 1..=max_attempts {
                    match TcpStream::connect_timeout(
                        &"127.0.0.1:4096".parse().unwrap(),
                        Duration::from_millis(500),
                    ) {
                        Ok(_) => {
                            println!("API Server is ready (attempt {})", attempt);
                            return;
                        }
                        Err(_) => {
                            // Server not ready yet, continue polling
                        }
                    }

                    if attempt < max_attempts {
                        std::thread::sleep(Duration::from_millis(delay_ms));
                    }
                }

                eprintln!("Warning: API Server did not become ready after {} attempts", max_attempts);
            });

            // Give the server a moment to start before continuing
            // The port check will ensure readiness in the background
            std::thread::sleep(std::time::Duration::from_millis(500));

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}