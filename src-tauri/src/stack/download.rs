use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::stack::manifest::{self, VersionEntry};
use crate::stack::store::{selected_version_id, zip_cache_path_for, zip_cache_path_for_store};
use crate::stack::types::StackStore;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub component: String,
    pub version_id: String,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: Option<f32>,
    pub phase: String,
}

pub const STACK_DOWNLOADER_UA: &str = "dev-tools-stack-downloader";

pub fn zip_cache_path(component: &str) -> Result<PathBuf, String> {
    let version_id = selected_version_id(component)?;
    let (_, ver) = manifest::resolve_version(component, Some(&version_id))?;
    zip_cache_path_for(component, ver.filename)
}

pub fn is_downloaded(component: &str) -> bool {
    let store = crate::stack::store::load_store();
    selected_version_id(component)
        .ok()
        .map(|version_id| is_downloaded_for_store(&store, component, &version_id))
        .unwrap_or(false)
}

pub fn is_downloaded_for_store(store: &StackStore, component: &str, version_id: &str) -> bool {
    if component == "npm" {
        return store.node.is_some();
    }
    if component == "rabbitmq" {
        let rabbitmq_ok = manifest::resolve_version(component, Some(version_id))
            .ok()
            .and_then(|(_, ver)| zip_cache_path_for_store(store, ver.filename).ok())
            .map(|p| validate_component_archive(component, &p, min_bytes_for(component)).is_ok())
            .unwrap_or(false);
        return rabbitmq_ok && crate::stack::rabbitmq::deps::is_erlang_downloaded(store);
    }
    manifest::resolve_version(component, Some(version_id))
        .ok()
        .and_then(|(_, ver)| zip_cache_path_for_store(store, ver.filename).ok())
        .map(|p| validate_component_archive(component, &p, min_bytes_for(component)).is_ok())
        .unwrap_or(false)
}

pub fn validate_composer_phar(path: &Path, min_bytes: u64) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() < min_bytes {
        return Err(format!(
            "文件过小 ({} KB)，可能下载到了错误页面",
            meta.len() / 1024
        ));
    }
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).map_err(|e| e.to_string())?;
    if magic[0] == b'P' && magic[1] == b'K' {
        return Ok(());
    }
    if magic[0] == b'<' && magic[1] == b'!' {
        return Err(
            "下载到了错误页面，请删除 downloads 目录中的 composer-*.phar 后重试，或使用「本地包」"
                .into(),
        );
    }
    if (magic[0] == b'<' && magic[1] == b'?') || magic[0] == b'#' {
        return Ok(());
    }
    Err("不是有效的 Composer PHAR 文件".into())
}

pub fn validate_component_archive(component: &str, path: &Path, min_bytes: u64) -> Result<(), String> {
    match component {
        "composer" => validate_composer_phar(path, min_bytes),
        "pip" => validate_python_script(path, min_bytes),
        "npm" => Ok(()),
        _ => validate_zip_archive(path, min_bytes),
    }
}

pub fn validate_python_script(path: &Path, min_bytes: u64) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() < min_bytes {
        return Err(format!(
            "文件过小 ({} KB)，可能下载到了错误页面",
            meta.len() / 1024
        ));
    }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if text.trim_start().starts_with("<!") || text.trim_start().starts_with("<html") {
        return Err("下载到了错误页面，请删除 downloads 中的 get-pip.py 后重试".into());
    }
    if text.contains("pip") || text.contains("def main") {
        Ok(())
    } else {
        Err("不是有效的 get-pip.py 脚本".into())
    }
}

pub fn validate_zip_archive(path: &Path, min_bytes: u64) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() < min_bytes {
        return Err(format!(
            "文件过小 ({} KB)，可能下载到了错误页面",
            meta.len() / 1024
        ));
    }
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).map_err(|e| e.to_string())?;
    if magic[0] != b'P' || magic[1] != b'K' {
        if magic[0] == b'<' {
            return Err(
                "下载到了错误页面（国内镜像可能已失效），请删除 downloads 目录中的 php-*.zip 后重试，或使用「本地包」选择官方 zip"
                    .into(),
            );
        }
        return Err("不是有效的 ZIP 文件".into());
    }
    Ok(())
}

fn min_bytes_for(component: &str) -> u64 {
    match component {
        "php" => 5 * 1024 * 1024,
        "mysql" => 40 * 1024 * 1024,
        "mariadb" => 40 * 1024 * 1024,
        "nginx" => 500 * 1024,
        "openresty" => 5 * 1024 * 1024,
        "composer" => 500 * 1024,
        "python" => 5 * 1024 * 1024,
        "pip" => 100 * 1024,
        "go" => 30 * 1024 * 1024,
        "node" => 10 * 1024 * 1024,
        "npm" => 1,
        "redis" => 800 * 1024,
        "rabbitmq" => 20 * 1024 * 1024,
        _ => 1024,
    }
}

pub fn download_component(
    app: &AppHandle,
    component: &str,
    version_id: Option<&str>,
) -> Result<PathBuf, String> {
    let stored = selected_version_id(component)?;
    let vid = version_id.unwrap_or(&stored);
    let (_, ver) = manifest::resolve_version(component, Some(vid))?;
    let dest = zip_cache_path_for(component, ver.filename)?;
    let min_bytes = min_bytes_for(component);

    if dest.exists() {
        if validate_component_archive(component, &dest, min_bytes).is_ok() {
            emit(
                app,
                component,
                vid,
                dest.metadata().ok().map(|m| m.len()).unwrap_or(0),
                None,
                "done",
            );
            return Ok(dest);
        }
        let _ = fs::remove_file(&dest);
    }

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    if component == "npm" {
        let store = crate::stack::store::load_store();
        if store.node.is_none() {
            return Err("请先安装 Node.js，再安装 npm".into());
        }
        fs::write(&dest, b"npm bundled with node\n").map_err(|e| e.to_string())?;
        emit(
            app,
            component,
            vid,
            dest.metadata().ok().map(|m| m.len()).unwrap_or(0),
            None,
            "done",
        );
        return Ok(dest);
    }

    if component == "rabbitmq" {
        let store = crate::stack::store::load_store();
        crate::stack::rabbitmq::deps::download_erlang(app, &store, vid)?;
    }

    let client = build_client()?;
    let urls = version_download_urls(ver);
    let mut errors = Vec::new();

    for (index, url) in urls.iter().enumerate() {
        emit(app, component, vid, 0, None, "connecting");
        match download_from_url(app, &client, component, vid, url, &dest, min_bytes) {
            Ok(path) => {
                return Ok(path);
            }
            Err(err) => {
                let _ = fs::remove_file(&dest);
                errors.push(format!("[{index}] {url}: {err}"));
            }
        }
    }

    Err(format!(
        "所有下载源均失败（{} 个）。请检查网络，或使用「本地包」选择已下载的安装包。\n{}",
        errors.len(),
        errors.join("\n")
    ))
}

pub(crate) fn build_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(3600))
        .user_agent(STACK_DOWNLOADER_UA)
        .build()
        .map_err(|e| e.to_string())
}

fn version_download_urls(ver: &VersionEntry) -> Vec<&str> {
    let mut urls = Vec::with_capacity(1 + ver.mirror_urls.len());
    urls.push(ver.url);
    urls.extend(ver.mirror_urls.iter().copied());
    urls
}

fn download_from_url(
    app: &AppHandle,
    client: &reqwest::blocking::Client,
    component: &str,
    version_id: &str,
    url: &str,
    dest: &PathBuf,
    min_bytes: u64,
) -> Result<PathBuf, String> {
    let mut response = client
        .get(url)
        .send()
        .map_err(|e| format!("连接失败: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let total = response.content_length();
    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 64 * 1024];

    emit(app, component, version_id, 0, total, "downloading");

    loop {
        let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
        downloaded += n as u64;
        emit(app, component, version_id, downloaded, total, "downloading");
    }

    drop(file);
    validate_component_archive(component, dest, min_bytes)?;

    emit(app, component, version_id, downloaded, total, "done");
    Ok(dest.clone())
}

fn emit(
    app: &AppHandle,
    component: &str,
    version_id: &str,
    downloaded: u64,
    total: Option<u64>,
    phase: &str,
) {
    let percent = total.filter(|t| *t > 0).map(|t| downloaded as f32 / t as f32 * 100.0);
    let _ = app.emit(
        "stack-download-progress",
        DownloadProgress {
            component: component.to_string(),
            version_id: version_id.to_string(),
            downloaded,
            total,
            percent,
            phase: phase.to_string(),
        },
    );
}

pub fn resolve_source(
    component: &str,
    source_path: Option<&str>,
    version_id: Option<&str>,
) -> Result<PathBuf, String> {
    if let Some(path) = source_path {
        let p = PathBuf::from(path);
        if !p.exists() {
            return Err(format!("路径不存在: {path}"));
        }
        if p.is_file() {
            validate_component_archive(component, &p, min_bytes_for(component))?;
        }
        return Ok(p);
    }
    let stored = selected_version_id(component)?;
    let vid = version_id.unwrap_or(&stored);
    let (_, ver) = manifest::resolve_version(component, Some(vid))?;
    let dest = zip_cache_path_for(component, ver.filename)?;
    if !dest.exists() {
        return Err(format!("请先下载 {} ({})", component, ver.label));
    }
    validate_component_archive(component, &dest, min_bytes_for(component))?;
    Ok(dest)
}
