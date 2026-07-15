use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::State;
use tauri::Emitter;

pub struct SettingsState {
    pub settings: Arc<Mutex<AppSettings>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub auto_start: bool,
    pub close_to_tray: bool,
    #[serde(default)]
    pub shortcuts: HashMap<String, String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();
        shortcuts.insert("clipboard".to_string(), "Ctrl+Shift+V".to_string());
        Self {
            auto_start: false,
            close_to_tray: true,
            shortcuts,
        }
    }
}

impl AppSettings {
    fn path() -> std::path::PathBuf {
        crate::app_paths::app_data_dir().join("settings.json")
    }

    pub fn load() -> Self {
        let path = Self::path();
        let mut settings: AppSettings = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();

        // Sync auto_start with the actual OS state on load
        if let Ok(enabled) = query_autostart_enabled() {
            settings.auto_start = enabled;
        }

        // Ensure clipboard shortcut exists with default
        if !settings.shortcuts.contains_key("clipboard") {
            settings.shortcuts.insert("clipboard".to_string(), "Ctrl+Shift+V".to_string());
        }

        settings
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::path();
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())
    }
}

const AUTOSTART_APP_NAME: &str = crate::app_paths::APP_NAME;

fn build_autostart() -> Result<auto_launch::AutoLaunch, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    auto_launch::AutoLaunchBuilder::new()
        .set_app_name(AUTOSTART_APP_NAME)
        .set_app_path(exe_path.to_str().ok_or("Invalid exe path")?)
        .build()
        .map_err(|e| e.to_string())
}

fn query_autostart_enabled() -> Result<bool, String> {
    let autolaunch = build_autostart()?;
    autolaunch.is_enabled().map_err(|e| e.to_string())
}

fn update_autostart(enabled: bool) -> Result<(), String> {
    let autolaunch = build_autostart()?;

    if enabled {
        autolaunch
            .enable()
            .map_err(|e| format!("启用开机自启动失败: {}", e))?;
    } else if autolaunch.is_enabled().unwrap_or(false) {
        autolaunch
            .disable()
            .map_err(|e| format!("禁用开机自启动失败: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?.clone();

    if let Ok(enabled) = query_autostart_enabled() {
        settings.auto_start = enabled;
    }

    Ok(settings)
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, SettingsState>,
    auto_start: bool,
    close_to_tray: bool,
    shortcuts: HashMap<String, String>,
) -> Result<AppSettings, String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.auto_start = auto_start;
    settings.close_to_tray = close_to_tray;
    settings.shortcuts = shortcuts;
    settings.save()?;

    update_autostart(auto_start)?;

    Ok(settings.clone())
}

#[tauri::command]
pub fn update_shortcuts(
    app: tauri::AppHandle,
    state: State<'_, SettingsState>,
    shortcuts: HashMap<String, String>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.shortcuts = shortcuts;
    settings.save()?;

    // Re-register shortcuts in the app
    crate::register_shortcuts_for_app(&app, &settings.shortcuts);

    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

const TRAY_ID: &str = "main";

fn remove_tray_icon_before_exit(app: &tauri::AppHandle) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Err(e) = tray.set_visible(false) {
            log::warn!("退出时移除托盘图标失败: {e}");
        }
    }
}

#[derive(Serialize, Clone)]
pub struct UpdateDownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[tauri::command]
pub async fn install_update_and_restart(app: tauri::AppHandle) -> Result<bool, String> {
    use futures_util::StreamExt;
    use tauri_plugin_updater::UpdaterExt;

    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("初始化更新器失败: {e}"))?;

    let Some(update) = updater
        .check()
        .await
        .map_err(|e| format!("检查更新失败: {e}"))?
    else {
        return Ok(false);
    };

    log::info!("开始下载应用更新: {}", update.version);

    let client = reqwest::Client::builder()
        .user_agent("dev-tools-app")
        .build()
        .map_err(|e| format!("创建下载客户端失败: {e}"))?;

    let response = client
        .get(update.download_url.clone())
        .send()
        .await
        .map_err(|e| format!("下载更新失败: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("下载更新失败: HTTP {}", response.status()));
    }

    let total = response.content_length();
    let mut downloaded: u64 = 0;
    let mut buffer = Vec::new();
    let mut stream = response.bytes_stream();
    let progress_handle = app.clone();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取更新数据失败: {e}"))?;
        downloaded = downloaded.saturating_add(chunk.len() as u64);
        buffer.extend_from_slice(&chunk);
        let _ = progress_handle.emit(
            "update-download-progress",
            UpdateDownloadProgress {
                downloaded,
                total,
            },
        );
    }

    log::info!(
        "更新包下载完成: {} bytes -> {}",
        buffer.len(),
        update.download_url
    );

    log::info!("开始安装应用更新: {}", update.version);

    #[cfg(target_os = "windows")]
    {
        remove_tray_icon_before_exit(&app);
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        update
            .install(buffer)
            .map_err(|e| format!("Windows 更新安装失败: {e}"))?;
        return Ok(true);
    }

    #[cfg(not(target_os = "windows"))]
    {
        update
            .install(buffer)
            .map_err(|e| format!("安装更新失败: {e}"))?;
        remove_tray_icon_before_exit(&app);
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        app.restart();
        Ok(true)
    }
}
