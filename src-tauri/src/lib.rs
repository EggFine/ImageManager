#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Window chrome strategy:
            //   - macOS: keep native decorations on (traffic lights overlaid on
            //     our transparent title bar — see `titleBarStyle: "Overlay"`
            //     in tauri.conf.json). Custom WinControls are hidden in the
            //     frontend on this platform.
            //   - Windows / Linux: turn decorations OFF so our custom editorial
            //     title bar (WinControls on the right) is the only chrome.
            //
            // tauri.conf.json sets `decorations: true` so macOS keeps its
            // native chrome by default — this block strips it elsewhere.
            #[cfg(not(target_os = "macos"))]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
