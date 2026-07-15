use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

pub const APP_NAME: &str = "Dev Env";
pub const APP_DATA_DIR: &str = "dev-env";

pub fn app_data_dir() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(APP_DATA_DIR);
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn logs_dir() -> PathBuf {
    let dir = app_data_dir().join("logs");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn append_diagnostic(relative_path: &str, section: &str, message: &str) {
    let path = app_data_dir().join(relative_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    let entry = format!("\n=== {timestamp} [{section}] ===\n{message}\n");
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = file.write_all(entry.as_bytes());
    }
}
