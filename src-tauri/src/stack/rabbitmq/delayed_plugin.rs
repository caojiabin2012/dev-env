use std::fs;
use std::path::{Path, PathBuf};

const PLUGIN_NAME: &str = "rabbitmq_delayed_message_exchange";
const MIN_EZ_BYTES: u64 = 32 * 1024;

/// 解析 RabbitMQ 版本号，优先从安装目录名读取。
pub fn parse_rabbitmq_version(home_dir: &Path, version_label: &str) -> Option<(u32, u32, u32)> {
    if let Some(name) = home_dir.file_name().and_then(|s| s.to_str()) {
        if let Some(ver) = name.strip_prefix("rabbitmq_server-") {
            if let Some(parsed) = parse_version_triple(ver) {
                return Some(parsed);
            }
        }
    }
    let digits: String = version_label
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    if digits.is_empty() {
        return None;
    }
    parse_version_triple(&digits)
}

fn parse_version_triple(raw: &str) -> Option<(u32, u32, u32)> {
    let parts: Vec<&str> = raw.split('.').collect();
    if parts.len() < 2 {
        return None;
    }
    let major = parts[0].parse().ok()?;
    let minor = parts[1].parse().ok()?;
    let patch = parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0);
    Some((major, minor, patch))
}

/// 当前 RabbitMQ 版本是否支持社区版延时消息插件。
pub fn is_version_supported(home_dir: &Path, version_label: &str) -> bool {
    plugin_release(home_dir, version_label).is_some()
}

pub fn unsupported_message(home_dir: &Path, version_label: &str) -> Option<&'static str> {
    let (major, minor, _) = parse_rabbitmq_version(home_dir, version_label)?;
    if major > 4 || (major == 4 && minor >= 3) {
        return Some(
            "RabbitMQ 4.3+ 已移除 Mnesia，社区版延时插件已停更；如需延时消息请改用 4.2.x",
        );
    }
    None
}

fn plugin_release(home_dir: &Path, version_label: &str) -> Option<&'static str> {
    let (major, minor, _) = parse_rabbitmq_version(home_dir, version_label)?;
    match (major, minor) {
        (4, 2) => Some("4.2.0"),
        (4, 1) => Some("4.1.0"),
        (4, 0) => Some("4.0.7"),
        (3, 13) => Some("3.13.0"),
        (3, 12) => Some("3.12.0"),
        (3, 11) => Some("3.11.1"),
        (3, 10) => Some("3.10.2"),
        (4, n) if n >= 3 => None,
        _ => None,
    }
}

pub fn is_installed(home: &Path) -> bool {
    installed_ez_path(home).is_some()
}

fn installed_ez_path(home: &Path) -> Option<PathBuf> {
    let plugins_dir = home.join("plugins");
    let entries = fs::read_dir(&plugins_dir).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(PLUGIN_NAME) && name.ends_with(".ez") {
            return Some(entry.path());
        }
    }
    None
}

fn ez_filename(release: &str) -> String {
    format!("{PLUGIN_NAME}-{release}.ez")
}

fn download_urls(release: &str) -> Vec<String> {
    let file = ez_filename(release);
    vec![
        format!(
            "https://ghfast.top/https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v{release}/{file}"
        ),
        format!(
            "https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v{release}/{file}"
        ),
    ]
}

/// 确保延时插件 `.ez` 已放入 RabbitMQ 插件目录；不支持版本返回 `Ok(false)`。
pub fn ensure_delayed_plugin(
    install_root: &Path,
    home: &Path,
    version_label: &str,
) -> Result<bool, String> {
    if is_installed(home) {
        return Ok(true);
    }
    let Some(release) = plugin_release(home, version_label) else {
        return Ok(false);
    };

    let plugins_dir = home.join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    let dest = plugins_dir.join(ez_filename(release));

    if try_copy_from_downloads(install_root, release, &dest)? {
        return Ok(true);
    }
    if try_download(install_root, release, &dest)? {
        return Ok(true);
    }

    Err(format!(
        "未能自动安装延时消息插件 {PLUGIN_NAME}-{release}.ez。\
         请从 GitHub Releases 下载后放入 {} 或 {}/downloads/ 后重启 RabbitMQ",
        plugins_dir.display(),
        install_root.display()
    ))
}

/// 启动时使用：仅从本地 downloads 复制，不在启动路径中联网下载。
pub fn ensure_delayed_plugin_local(
    install_root: &Path,
    home: &Path,
    version_label: &str,
) -> Result<bool, String> {
    if is_installed(home) {
        return Ok(true);
    }
    let Some(release) = plugin_release(home, version_label) else {
        return Ok(false);
    };
    let plugins_dir = home.join("plugins");
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    let dest = plugins_dir.join(ez_filename(release));
    try_copy_from_downloads(install_root, release, &dest)
}

fn try_copy_from_downloads(install_root: &Path, release: &str, dest: &Path) -> Result<bool, String> {
    let file = ez_filename(release);
    let exact = install_root.join("downloads").join(&file);
    if exact.exists() {
        return copy_ez(&exact, dest).map(|_| true);
    }
    let downloads = install_root.join("downloads");
    if !downloads.is_dir() {
        return Ok(false);
    }
    for entry in fs::read_dir(&downloads).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(PLUGIN_NAME) && name.ends_with(".ez") {
            return copy_ez(&entry.path(), dest).map(|_| true);
        }
    }
    Ok(false)
}

fn try_download(install_root: &Path, release: &str, dest: &Path) -> Result<bool, String> {
    let cache = install_root.join("downloads").join(ez_filename(release));
    if let Some(parent) = cache.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    for url in download_urls(release) {
        if download_file(&url, &cache).is_ok() {
            if validate_ez(&cache).is_ok() {
                copy_ez(&cache, dest)?;
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn validate_ez(path: &Path) -> Result<(), String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() < MIN_EZ_BYTES {
        return Err(format!(
            "插件文件过小 ({} KB)，可能下载到了错误页面",
            meta.len() / 1024
        ));
    }
    Ok(())
}

fn copy_ez(from: &Path, dest: &Path) -> Result<(), String> {
    validate_ez(from)?;
    fs::copy(from, dest).map_err(|e| format!("复制插件失败: {e}"))?;
    Ok(())
}

fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    use reqwest::blocking::Client;
    use crate::stack::download::STACK_DOWNLOADER_UA;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .user_agent(STACK_DOWNLOADER_UA)
        .build()
        .map_err(|e| e.to_string())?;
    let mut resp = client.get(url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    resp.copy_to(&mut file).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_version_from_home_dir() {
        let home = Path::new(r"D:\rabbitmq\server\rabbitmq_server-4.2.8");
        let v = parse_rabbitmq_version(home, "RabbitMQ 4.2.8").unwrap();
        assert_eq!(v, (4, 2, 8));
    }

    #[test]
    fn plugin_release_for_4_2() {
        let home = Path::new("rabbitmq_server-4.2.8");
        assert_eq!(plugin_release(home, "RabbitMQ 4.2.8"), Some("4.2.0"));
    }

    #[test]
    fn plugin_unsupported_for_4_3() {
        let home = Path::new("rabbitmq_server-4.3.2");
        assert!(plugin_release(home, "RabbitMQ 4.3.2").is_none());
        assert!(unsupported_message(home, "RabbitMQ 4.3.2").is_some());
    }
}
