use std::fs;
use std::path::Path;

use crate::stack::download::resolve_source;
use crate::stack::extract::{extract_zip, find_php_home};
use crate::stack::process_util::{
    check_port_before_start_with_process, find_pid_by_port, kill_pid,
    service_status, spawn_service_in, wait_for_port,
};
use crate::stack::store::{load_store, php_runtime_ini_path, require_install_root, save_store};
use crate::stack::types::PhpInstall;

mod redis_ext;

const RUNTIME_INI_NAME: &str = "devtools-php.ini";

pub fn install(
    source_path: Option<&str>,
    port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<PhpInstall, String> {
    let install_root = require_install_root()?;
    let source = resolve_source("php", source_path, version_id)?;
    let base = install_root.join("php");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_php_home(scan_root)?;

    let install = PhpInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
        port,
        pid: None,
    };

    write_config(&install_root, &install)?;
    remove_legacy_ini_if_present(&install_root);

    let mut store = load_store();
    store.php = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn write_config(install_root: &Path, install: &PhpInstall) -> Result<(), String> {
    let home_dir = Path::new(&install.home_dir);
    let ini_path = php_runtime_ini_path(home_dir);
    let logs_dir = install_root.join("php").join("logs");
    let sessions_dir = install_root.join("php").join("sessions");
    fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&sessions_dir).map_err(|e| e.to_string())?;

    let template = home_dir.join("php.ini-development");
    let mut ini = if template.exists() {
        fs::read_to_string(&template).map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    let ext_dir = home_dir.join("ext");
    let ext_dir_str = path_forward(&ext_dir);
    let error_log = path_forward(&logs_dir.join("php_error.log"));
    let session_path = path_forward(&sessions_dir);

    append_ini_directive(&mut ini, "extension_dir", &format!("\"{ext_dir_str}\""));
    let _ = redis_ext::ensure_redis_dll(install_root, home_dir);
    // openssl 需在 pdo_mysql / redis 之前加载
    for ext in [
        "openssl",
        "pdo",
        "pdo_mysql",
        "mbstring",
        "curl",
        "fileinfo",
        "gd",
        "zip",
        "redis",
    ] {
        ensure_extension_enabled(&mut ini, &ext_dir, ext);
    }

    append_ini_directive(&mut ini, "date.timezone", "Asia/Shanghai");
    append_ini_directive(&mut ini, "upload_max_filesize", "128M");
    append_ini_directive(&mut ini, "post_max_size", "128M");
    append_ini_directive(&mut ini, "max_execution_time", "300");
    append_ini_directive(&mut ini, "memory_limit", "256M");
    append_ini_directive(&mut ini, "display_errors", "On");
    append_ini_directive(&mut ini, "error_reporting", "E_ALL");
    append_ini_directive(&mut ini, "error_log", &format!("\"{error_log}\""));
    append_ini_directive(&mut ini, "session.save_path", &format!("\"{session_path}\""));
    append_ini_directive(&mut ini, "cgi.fix_pathinfo", "1");

    fs::write(&ini_path, ini).map_err(|e| e.to_string())
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if let Some(php) = store.php.take() {
        let _ = stop(&php);
    }
    save_store(&store)
}

pub fn start() -> Result<PhpInstall, String> {
    let mut store = load_store();
    let install = store.php.as_ref().ok_or("PHP 尚未安装")?.clone();
    let root = store.install_root.as_ref().ok_or("安装目录未设置")?;
    write_config(Path::new(root), &install)?;

    if let Some(running_pid) =
        check_port_before_start_with_process(install.port, install.pid, "PHP", Some("php-cgi.exe"))?
    {
        if let Some(ref mut p) = store.php {
            if p.pid.is_none() {
                p.pid = Some(running_pid);
                save_store(&store)?;
            }
        }
        return Ok(install);
    }

    let home = Path::new(&install.home_dir);
    let cgi = home.join("php-cgi.exe");
    if !cgi.exists() {
        return Err(format!("未找到 php-cgi.exe: {}", cgi.display()));
    }
    let bind = format!("127.0.0.1:{}", install.port);
    spawn_service_in(
        &cgi,
        Some(home),
        &["-b", &bind, "-c", RUNTIME_INI_NAME],
    )?;
    if !wait_for_port(install.port, std::time::Duration::from_secs(8)) {
        return Err(format!(
            "PHP FastCGI 启动失败，端口 {} 未监听。请查看 {} 目录下的 {}",
            install.port,
            home.display(),
            RUNTIME_INI_NAME
        ));
    }
    let pid = find_pid_by_port(install.port);
    if let Some(ref mut p) = store.php {
        p.pid = pid;
        save_store(&store)?;
    }
    store.php.clone().ok_or_else(|| "PHP 状态丢失".into())
}

pub fn stop(install: &PhpInstall) -> Result<(), String> {
    if let Some(pid) = install.pid.or_else(|| find_pid_by_port(install.port)) {
        kill_pid(pid)?;
    }
    let mut store = load_store();
    if let Some(ref mut p) = store.php {
        p.pid = None;
        save_store(&store)?;
    }
    Ok(())
}

pub fn stop_from_store() -> Result<PhpInstall, String> {
    let install = load_store().php.ok_or("PHP 尚未安装")?;
    stop(&install)?;
    load_store().php.ok_or_else(|| "PHP 状态丢失".into())
}

pub fn status(install: &PhpInstall) -> crate::stack::types::ServiceStatus {
    service_status(install.port, install.pid)
}

pub fn runtime_ini_path(install: &PhpInstall) -> std::path::PathBuf {
    php_runtime_ini_path(Path::new(&install.home_dir))
}

pub fn log_path(install_root: &Path) -> std::path::PathBuf {
    install_root.join("php").join("logs").join("php_error.log")
}

fn remove_legacy_ini_if_present(install_root: &Path) {
    let legacy = install_root.join("php").join("devtools-php.ini");
    let _ = fs::remove_file(legacy);
}

fn append_ini_directive(ini: &mut String, key: &str, value: &str) {
    let line = format!("{key} = {value}");
    if ini.lines().any(|l| l.trim_start().starts_with(key)) {
        return;
    }
    if !ini.ends_with('\n') {
        ini.push('\n');
    }
    ini.push_str(&format!("\n; dev-tools\n{line}\n"));
}

fn ensure_extension_enabled(ini: &mut String, ext_dir: &Path, ext: &str) {
    let dll = ext_dir.join(format!("php_{ext}.dll"));
    if !dll.exists() {
        return;
    }
    if is_extension_enabled(ini, ext) {
        return;
    }
    let commented = format!(";extension={ext}");
    if ini.contains(&commented) {
        *ini = ini.replace(&commented, &format!("extension={ext}"));
        return;
    }
    if !ini.ends_with('\n') {
        ini.push('\n');
    }
    ini.push_str(&format!("\n; dev-tools\nextension={ext}\n"));
}

fn is_extension_enabled(ini: &str, ext: &str) -> bool {
    let target = format!("extension={ext}");
    ini.lines().any(|line| {
        let trimmed = line.trim();
        trimmed == target || trimmed.starts_with(&format!("{target} "))
    })
}

fn path_forward(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
