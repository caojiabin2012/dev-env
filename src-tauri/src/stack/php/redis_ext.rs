use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::download::validate_zip_archive;
use crate::stack::extract::extract_zip;

const REDIS_PECL_VERSION: &str = "6.3.0";

struct PhpProfile {
    mm: String,
    thread: String,
    vs: String,
}

/// 确保 `ext/php_redis.dll` 存在（本地包 / 下载 / 内置资源）。
pub fn ensure_redis_dll(install_root: &Path, home: &Path) -> Result<(), String> {
    let ext_dir = home.join("ext");
    fs::create_dir_all(&ext_dir).map_err(|e| e.to_string())?;
    if ext_dir.join("php_redis.dll").exists() {
        return Ok(());
    }

    let profile = parse_php_profile(home)?;
    if try_extract_from_downloads(install_root, &profile, &ext_dir)? {
        return Ok(());
    }
    if try_download_redis(install_root, &profile, &ext_dir)? {
        return Ok(());
    }
    try_copy_bundled(&profile, &ext_dir)
}

fn parse_php_profile(home: &Path) -> Result<PhpProfile, String> {
    let snapshot = fs::read_to_string(home.join("snapshot.txt")).map_err(|e| e.to_string())?;
    let mut version = None;
    let mut vs = None;
    for line in snapshot.lines() {
        if let Some(v) = line.strip_prefix("Version:") {
            version = Some(v.trim().to_string());
        }
        if line.contains("Build:") {
            if line.contains("vs17") {
                vs = Some("vs17".into());
            } else if line.contains("vs16") {
                vs = Some("vs16".into());
            }
        }
    }
    let ver = version.ok_or("无法从 snapshot.txt 读取 PHP 版本")?;
    let parts: Vec<_> = ver.split('.').collect();
    let mm = if parts.len() >= 2 {
        format!("{}.{}", parts[0], parts[1])
    } else {
        ver.clone()
    };
    let mm_for_vs = mm.clone();
    Ok(PhpProfile {
        mm,
        thread: "nts".into(),
        vs: vs.unwrap_or_else(|| {
            if mm_for_vs.starts_with("8.4") || mm_for_vs.starts_with("8.5") {
                "vs17".into()
            } else {
                "vs16".into()
            }
        }),
    })
}

fn zip_name(profile: &PhpProfile) -> String {
    format!(
        "php_redis-{REDIS_PECL_VERSION}-{}-{}-{}-x64.zip",
        profile.mm, profile.thread, profile.vs
    )
}

fn try_extract_from_downloads(
    install_root: &Path,
    profile: &PhpProfile,
    ext_dir: &Path,
) -> Result<bool, String> {
    let downloads = install_root.join("downloads");
    if !downloads.is_dir() {
        return Ok(false);
    }
    let exact = downloads.join(zip_name(profile));
    if exact.is_file() {
        return extract_redis_zip(&exact, ext_dir).map(|_| true);
    }
    let Ok(entries) = fs::read_dir(&downloads) else {
        return Ok(false);
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.starts_with("php_redis") && name.ends_with(".zip") {
            return extract_redis_zip(&entry.path(), ext_dir).map(|_| true);
        }
    }
    Ok(false)
}

fn try_download_redis(
    install_root: &Path,
    profile: &PhpProfile,
    ext_dir: &Path,
) -> Result<bool, String> {
    let file = zip_name(profile);
    let urls = [
        format!(
            "https://ghfast.top/https://downloads.php.net/~windows/pecl/releases/redis/{REDIS_PECL_VERSION}/{file}"
        ),
        format!(
            "https://downloads.php.net/~windows/pecl/releases/redis/{REDIS_PECL_VERSION}/{file}"
        ),
        format!("https://windows.php.net/downloads/pecl/releases/redis/{REDIS_PECL_VERSION}/{file}"),
    ];
    let cache = install_root.join("downloads").join(&file);
    fs::create_dir_all(cache.parent().unwrap()).map_err(|e| e.to_string())?;

    for url in urls {
        if download_file(&url, &cache).is_ok() {
            if extract_redis_zip(&cache, ext_dir).is_ok() {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn try_copy_bundled(profile: &PhpProfile, ext_dir: &Path) -> Result<(), String> {
    let bundled_name = format!("{}-{}-{}-x64", profile.mm, profile.thread, profile.vs);
    let bundled = bundled_redis_path(&bundled_name);
    let Some(src) = bundled else {
        return Err(format!(
            "未能自动安装 php_redis 扩展。请下载 {} 放入 downloads 目录后，点击「重新生成配置文件」或重启 PHP",
            zip_name(profile)
        ));
    };
    fs::copy(&src, ext_dir.join("php_redis.dll")).map_err(|e| e.to_string())?;
    Ok(())
}

fn bundled_redis_path(profile_key: &str) -> Option<PathBuf> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("bundled")
        .join("php-ext")
        .join(format!("php_redis-{profile_key}.dll"));
    path.exists().then_some(path)
}

fn extract_redis_zip(zip_path: &Path, ext_dir: &Path) -> Result<(), String> {
    validate_zip_archive(zip_path, 32 * 1024)?;
    let temp = ext_dir
        .parent()
        .unwrap_or(ext_dir)
        .join("_redis_ext_tmp");
    let _ = fs::remove_dir_all(&temp);
    extract_zip(zip_path, &temp)?;
    copy_redis_dlls(&temp, ext_dir)?;
    let _ = fs::remove_dir_all(&temp);
    if ext_dir.join("php_redis.dll").exists() {
        Ok(())
    } else {
        Err(format!(
            "zip 中未找到 php_redis.dll: {}",
            zip_path.display()
        ))
    }
}

fn copy_redis_dlls(from: &Path, ext_dir: &Path) -> Result<(), String> {
    copy_matching_dlls(from, ext_dir)?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_matching_dlls(&entry.path(), ext_dir)?;
        }
    }
    Ok(())
}

fn copy_matching_dlls(dir: &Path, ext_dir: &Path) -> Result<(), String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.eq_ignore_ascii_case("php_redis.dll")
            || name.eq_ignore_ascii_case("php_redis_nts.dll")
            || name.eq_ignore_ascii_case("php_igbinary.dll")
        {
            let dest_name = if name.eq_ignore_ascii_case("php_redis_nts.dll") {
                "php_redis.dll"
            } else {
                name
            };
            fs::copy(&path, ext_dir.join(dest_name)).map_err(|e| e.to_string())?;
        }
    }
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
