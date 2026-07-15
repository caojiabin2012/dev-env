use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::stack::download::resolve_source;
use crate::stack::extract::{extract_zip, find_home_with_binary};
use crate::stack::process_util::{
    check_port_before_start_with_process, find_pid_by_port, is_port_listening, kill_pid,
    service_status, spawn_service_in, tail_file, wait_for_port,
};
use crate::stack::sites::{resolve_site_path, sites_for_web_server};
use crate::stack::store::{load_store, require_install_root, resolve_site_root, save_store};
use crate::stack::types::{NginxInstall, StackStore};

pub fn install(
    source_path: Option<&str>, port: u16, version_name: &str, version_id: Option<&str>,
) -> Result<NginxInstall, String> {
    let mut store = load_store();
    let install_root = require_install_root()?;
    let source = resolve_source("caddy", source_path, version_id)?;
    let base = install_root.join("caddy");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() { extract_zip(&source, &base)?; }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["caddy.exe"])?;

    let install = NginxInstall { version_label: version_name.to_string(), home_dir: home_dir.to_string_lossy().into_owned(), port, pid: None };
    store.caddy = Some(install.clone());
    save_store(&store)?;

    let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
    write_config(&install, php_port, &store, &install_root)?;
    Ok(install)
}

pub fn write_config(install: &NginxInstall, php_port: u16, store: &StackStore, install_root: &Path) -> Result<(), String> {
    let conf_path = install_root.join("caddy").join("Caddyfile");
    if let Some(p) = conf_path.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
    let conf = render_caddyfile(install.port, php_port, install_root, store);
    fs::write(&conf_path, conf).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn start() -> Result<NginxInstall, String> {
    let mut store = load_store();
    let install = store.caddy.as_ref().ok_or("Caddy 尚未安装")?.clone();
    let home = Path::new(&install.home_dir);
    let caddy = home.join("caddy.exe");
    if !caddy.exists() { return Err(format!("未找到 caddy.exe: {}", caddy.display())); }

    if let Some(running_pid) = check_port_before_start_with_process(install.port, install.pid, "Caddy", Some("caddy.exe"))? {
        if let Some(ref mut c) = store.caddy { if c.pid.is_none() { c.pid = Some(running_pid); save_store(&store)?; } }
        return Ok(install);
    }

    let root = store.install_root.as_ref().ok_or("安装目录未设置")?.clone();
    let install_root = Path::new(&root);
    let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
    write_config(&install, php_port, &store, install_root)?;
    let conf = install_root.join("caddy").join("Caddyfile");
    let conf_str = conf.to_string_lossy().into_owned();

    spawn_service_in(&caddy, Some(install_root), &["run", "--config", &conf_str])?;
    if !wait_for_port(install.port, Duration::from_secs(8)) {
        return Err(format!("Caddy 启动失败，端口 {} 未监听", install.port));
    }

    let pid = find_pid_by_port(install.port);
    if let Some(ref mut c) = store.caddy { c.pid = pid; save_store(&store)?; }
    store.caddy.clone().ok_or_else(|| "Caddy 状态丢失".into())
}

pub fn stop() -> Result<(), String> {
    let store = load_store();
    let install = store.caddy.as_ref().ok_or("Caddy 尚未安装")?;
    if is_port_listening(install.port) {
        if let Some(pid) = install.pid.or_else(|| find_pid_by_port(install.port)) { kill_pid(pid)?; }
    }
    let mut store = load_store();
    if let Some(ref mut c) = store.caddy { c.pid = None; save_store(&store)?; }
    Ok(())
}

pub fn stop_from_store() -> Result<NginxInstall, String> {
    let install = load_store().caddy.ok_or("Caddy 尚未安装")?;
    stop()?;
    load_store().caddy.ok_or_else(|| "Caddy 状态丢失".into())
}

pub fn status(install: &NginxInstall) -> crate::stack::types::ServiceStatus { service_status(install.port, install.pid) }

pub fn log_path(install: &NginxInstall) -> PathBuf { Path::new(&install.home_dir).join("caddy.log") }

pub fn runtime_conf_path(_install: &NginxInstall) -> PathBuf {
    let store = load_store();
    if let Some(root) = &store.install_root { Path::new(root).join("caddy").join("Caddyfile") }
    else { PathBuf::from("Caddyfile") }
}

pub fn reload_if_running(install: &NginxInstall) -> Result<(), String> {
    if !is_port_listening(install.port) { return Ok(()); }
    let home = Path::new(&install.home_dir);
    let caddy = home.join("caddy.exe");
    if !caddy.exists() { return Ok(()); }
    let store = load_store();
    if let Some(root) = &store.install_root {
        let conf = Path::new(root).join("caddy").join("Caddyfile");
        let conf_str = conf.to_string_lossy().into_owned();
        let _ = std::process::Command::new(&caddy).args(["reload", "--config", &conf_str]).output();
    }
    Ok(())
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if store.caddy.take().is_some() { let _ = stop(); }
    save_store(&store)
}

fn render_caddyfile(port: u16, php_port: u16, install_root: &Path, store: &StackStore) -> String {
    let bound_sites = sites_for_web_server(store, "caddy");
    let default_site = bound_sites.iter().find(|s| s.is_default).copied().or_else(|| bound_sites.first().copied());
    let default_root = default_site.map(|s| path_forward(&resolve_site_path(install_root, s)))
        .unwrap_or_else(|| path_forward(&resolve_site_root(install_root, &store.settings.www_subdir)));

    let mut caddyfile = format!(
        ":{} {{\n    root * {}\n    php_fastcgi 127.0.0.1:{}\n    file_server\n}}\n", port, default_root, php_port
    );

    let default_hostname = default_site.map(|s| s.hostname.as_str()).unwrap_or("localhost");
    for site in bound_sites {
        if site.hostname == default_hostname { continue; }
        let root = path_forward(&resolve_site_path(install_root, site));
        caddyfile.push_str(&format!(
            "{} {{\n    root * {}\n    php_fastcgi 127.0.0.1:{}\n    file_server\n}}\n", site.hostname, root, php_port
        ));
    }
    caddyfile
}

fn path_forward(path: &Path) -> String { path.to_string_lossy().replace('\\', "/") }
