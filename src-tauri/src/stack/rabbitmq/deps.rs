use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter};

use crate::stack::download::{build_client, validate_zip_archive, DownloadProgress, STACK_DOWNLOADER_UA};
use crate::stack::extract::{extract_zip, find_home_with_binary};
use crate::stack::store::{downloads_dir, zip_cache_path_for_store};
use crate::stack::types::StackStore;

pub const ERLANG_FILENAME: &str = "otp_win64_27.3.zip";
const ERLANG_URL: &str =
    "https://github.com/erlang/otp/releases/download/OTP-27.3/otp_win64_27.3.zip";
const ERLANG_MIRROR: &str =
    "https://ghfast.top/https://github.com/erlang/otp/releases/download/OTP-27.3/otp_win64_27.3.zip";
const ERLANG_MIN_BYTES: u64 = 80 * 1024 * 1024;

pub fn erlang_zip_path(store: &StackStore) -> Result<PathBuf, String> {
    zip_cache_path_for_store(store, ERLANG_FILENAME)
}

pub fn is_erlang_downloaded(store: &StackStore) -> bool {
    erlang_zip_path(store)
        .ok()
        .map(|p| validate_zip_archive(&p, ERLANG_MIN_BYTES).is_ok())
        .unwrap_or(false)
}

pub fn download_erlang(app: &AppHandle, store: &StackStore, version_id: &str) -> Result<PathBuf, String> {
    let dest = erlang_zip_path(store)?;
    if dest.exists() && validate_zip_archive(&dest, ERLANG_MIN_BYTES).is_ok() {
        return Ok(dest);
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let client = build_client()?;
    let urls = [ERLANG_MIRROR, ERLANG_URL];
    let mut errors = Vec::new();
    for (i, url) in urls.iter().enumerate() {
        match download_erlang_from_url(app, &client, version_id, url, &dest) {
            Ok(path) => return Ok(path),
            Err(err) => {
                let _ = fs::remove_file(&dest);
                errors.push(format!("[{i}] {url}: {err}"));
            }
        }
    }
    Err(format!("Erlang 下载失败:\n{}", errors.join("\n")))
}

fn download_erlang_from_url(
    app: &AppHandle,
    client: &reqwest::blocking::Client,
    version_id: &str,
    url: &str,
    dest: &Path,
) -> Result<PathBuf, String> {
    use std::io::{Read, Write};
    let mut response = client
        .get(url)
        .header("User-Agent", STACK_DOWNLOADER_UA)
        .send()
        .map_err(|e| format!("连接失败: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    let total = response.content_length();
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 64 * 1024];
    emit_erlang(app, version_id, downloaded, total, "downloading");
    loop {
        let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
        downloaded += n as u64;
        emit_erlang(app, version_id, downloaded, total, "downloading");
    }
    drop(file);
    validate_zip_archive(dest, ERLANG_MIN_BYTES)?;
    emit_erlang(app, version_id, downloaded, total, "done");
    Ok(dest.to_path_buf())
}

fn emit_erlang(
    app: &AppHandle,
    version_id: &str,
    downloaded: u64,
    total: Option<u64>,
    phase: &str,
) {
    let percent = total.filter(|t| *t > 0).map(|t| downloaded as f32 / t as f32 * 100.0);
    let _ = app.emit(
        "stack-download-progress",
        DownloadProgress {
            component: "rabbitmq".to_string(),
            version_id: version_id.to_string(),
            downloaded,
            total,
            percent,
            phase: phase.to_string(),
        },
    );
}

pub fn ensure_erlang_installed(install_root: &Path) -> Result<PathBuf, String> {
    let store = crate::stack::store::load_store();
    let erlang_root = install_root.join("erlang");
    if let Ok(home) = erlang_home_from_root(&erlang_root) {
        return Ok(home);
    }

    let zip = erlang_zip_path(&store)?;
    if !zip.exists() {
        return Err("请先下载 RabbitMQ（将自动下载 Erlang/OTP 依赖）".into());
    }
    fs::create_dir_all(&erlang_root).map_err(|e| e.to_string())?;
    extract_zip(&zip, &erlang_root)?;
    erlang_home_from_root(&erlang_root)
}

pub fn erlang_home_from_root(erlang_root: &Path) -> Result<PathBuf, String> {
    find_home_with_binary(erlang_root, &["bin", "erl.exe"])
}

pub fn erlang_extract_dir(install_root: &Path) -> PathBuf {
    install_root.join("erlang")
}

pub fn downloads_erlang_path(install_root: &Path) -> PathBuf {
    downloads_dir(install_root).join(ERLANG_FILENAME)
}
