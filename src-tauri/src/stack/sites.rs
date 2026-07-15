use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::stack::hosts::{ensure_entry, remove_entry};
use crate::stack::process_util::is_port_listening;
use crate::stack::store::{load_store, require_install_root, resolve_site_root, save_store};
use crate::stack::types::{AddSiteParams, NginxInstall, SiteProcess, StackStore, UpdateSiteParams, WebSite};

const WEB_SERVER_IDS: &[&str] = &["nginx", "openresty", "caddy"];


pub fn web_install<'a>(store: &'a StackStore, id: &str) -> Option<&'a NginxInstall> {
    match id {
        "nginx" => store.nginx.as_ref(),
        "openresty" => store.openresty.as_ref(),
        _ => None,
    }
}

fn web_display_name(id: &str) -> String {
    match id {
        "nginx" => "Nginx".into(),
        "openresty" => "OpenResty".into(),
        _ => id.to_string(),
    }
}

pub fn active_web_server(store: &StackStore) -> Option<(&'static str, &NginxInstall)> {
    for id in WEB_SERVER_IDS {
        if let Some(install) = web_install(store, id) {
            if is_port_listening(install.port) {
                return Some((id, install));
            }
        }
    }
    None
}

pub fn preferred_web_server(store: &StackStore) -> Option<(&'static str, &NginxInstall)> {
    if let Some(active) = active_web_server(store) {
        return Some(active);
    }
    for id in WEB_SERVER_IDS {
        if let Some(install) = web_install(store, id) {
            return Some((id, install));
        }
    }
    None
}

pub fn ensure_default_site(store: &mut StackStore) {
    if !store.sites.is_empty() {
        return;
    }
    let root = store.settings.www_subdir.trim().trim_matches(['/', '\\']);
    let root = if root.is_empty() {
        "www/default".to_string()
    } else {
        root.replace('\\', "/")
    };
    let (default_runtime, default_version, default_web) =
        crate::stack::site_runtime::default_site_fields(store);
    store.sites.push(WebSite {
        id: "default".into(),
        name: "默认站点".into(),
        hostname: "localhost".into(),
        root,
        enabled: true,
        is_default: true,
        runtime: default_runtime,
        runtime_version_id: default_version,
        web_server: default_web,
        port: None,
    });
}

pub fn add_site(params: &AddSiteParams) -> Result<WebSite, String> {
    let name = params.name.trim();
    if name.is_empty() {
        return Err("站点名称不能为空".into());
    }

    let mut store = load_store();
    let install_root = require_install_root()?;

    let slug = slugify(name);
    if store.sites.iter().any(|s| s.id == slug) {
        return Err(format!("站点 ID「{slug}」已存在，请换一个名称"));
    }

    let default_hostname = format!("{slug}.local");
    let hostname = params
        .hostname
        .as_deref()
        .map(str::trim)
        .filter(|h| !h.is_empty())
        .unwrap_or(&default_hostname)
        .to_string();

    if store
        .sites
        .iter()
        .any(|s| s.hostname.eq_ignore_ascii_case(&hostname))
    {
        return Err(format!("域名「{hostname}」已被其他站点使用"));
    }

    let root = params
        .root
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .map(|r| r.replace('\\', "/"))
        .unwrap_or_else(|| format!("www/{slug}"));

    if root.contains("..") {
        return Err("站点目录不能包含 ..".into());
    }

    crate::stack::site_runtime::validate_runtime(&params.runtime)?;
    let runtime_version_id =
        crate::stack::site_runtime::resolve_version_id(&params.runtime, params.runtime_version_id.as_deref())?;
    let web_server = crate::stack::site_runtime::resolve_web_server(&params.web_server, &store)?;

    // 为需要独立进程的运行时分配端口
    let runtime_port = if runtime_needs_process(&params.runtime) {
        Some(assign_site_port(&store))
    } else {
        None
    };

    let site = WebSite {
        id: slug,
        name: name.to_string(),
        hostname,
        root: root.clone(),
        enabled: true,
        is_default: store.sites.is_empty(),
        runtime: params.runtime.clone(),
        runtime_version_id,
        web_server,
        port: runtime_port,
    };

    let site_root = resolve_site_root(&install_root, &site.root);
    fs::create_dir_all(&site_root).map_err(|e| e.to_string())?;
    crate::stack::www::ensure_site_scaffold(&site_root, &site)?;

    ensure_entry(&site.hostname, &site.id)?;

    crate::stack::site_runtime::apply_site_version_pref(&mut store, &site);

    if site.is_default {
        store.settings.www_subdir = site.root.clone();
    }
    store.sites.push(site.clone());
    if let Err(err) = save_store(&store) {
        let _ = remove_entry(&site.hostname, &site.id);
        return Err(err);
    }
    Ok(site)
}

pub fn update_site(params: &UpdateSiteParams) -> Result<WebSite, String> {
    let mut store = load_store();
    let install_root = require_install_root()?;

    let idx = store
        .sites
        .iter()
        .position(|s| s.id == params.site_id)
        .ok_or_else(|| format!("站点不存在: {}", params.site_id))?;

    // 第一阶段：验证并计算新值（不可变借用）
    let site_id = store.sites[idx].id.clone();
    let new_name = if let Some(name) = &params.name {
        let trimmed = name.trim();
        if trimmed.is_empty() { return Err("站点名称不能为空".into()); }
        Some(trimmed.to_string())
    } else { None };

    let (new_hostname, need_hosts_update) = if let Some(hostname) = &params.hostname {
        let trimmed = hostname.trim();
        if trimmed.is_empty() { (None, false) }
        else {
            if store.sites.iter().any(|s| s.id != site_id && s.hostname.eq_ignore_ascii_case(trimmed)) {
                return Err(format!("域名「{trimmed}」已被其他站点使用"));
            }
            (Some(trimmed.to_string()), true)
        }
    } else { (None, false) };

    let new_root = if let Some(root) = &params.root {
        let trimmed = root.trim().replace('\\', "/");
        if trimmed.is_empty() { None }
        else {
            if trimmed.contains("..") { return Err("站点目录不能包含 ..".into()); }
            Some(trimmed)
        }
    } else { None };

    let (new_runtime, new_runtime_version_id, new_port) = if let Some(runtime) = &params.runtime {
        crate::stack::site_runtime::validate_runtime(runtime)?;
        if runtime == "static" {
            (Some("static".to_string()), None, None)
        } else {
            let vid = crate::stack::site_runtime::resolve_version_id(runtime, None)?;
            let port = if runtime_needs_process(runtime) && store.sites[idx].port.is_none() {
                Some(assign_site_port(&store))
            } else if runtime_needs_process(runtime) {
                store.sites[idx].port
            } else { None };
            (Some(runtime.clone()), vid, port)
        }
    } else {
        let (vid, keep_port) = if let Some(vid_str) = &params.runtime_version_id {
            if store.sites[idx].runtime != "static" {
                let resolved = crate::stack::site_runtime::resolve_version_id(&store.sites[idx].runtime, Some(vid_str))?;
                (resolved, store.sites[idx].port)
            } else { (None, store.sites[idx].port) }
        } else { (store.sites[idx].runtime_version_id.clone(), store.sites[idx].port) };
        (None, vid, keep_port)
    };

    let new_web_server = if let Some(web_server) = &params.web_server {
        Some(crate::stack::site_runtime::resolve_web_server(web_server, &store)?)
    } else { None };

    // 第二阶段：应用变更（作用域限制可变借用）
    let final_root;
    let final_runtime;
    let final_name;
    {
        let site = &mut store.sites[idx];
        if let Some(name) = new_name { site.name = name; }
        if let Some(hostname) = new_hostname {
            let old = site.hostname.clone();
            site.hostname = hostname;
            if need_hosts_update {
                let _ = remove_entry(&old, &site.id);
                ensure_entry(&site.hostname, &site.id)?;
            }
        }
        if let Some(root) = new_root {
            site.root = root;
            if site.is_default { store.settings.www_subdir = site.root.clone(); }
        }
        if let Some(runtime) = new_runtime { site.runtime = runtime; }
        site.runtime_version_id = new_runtime_version_id;
        if let Some(port) = new_port { site.port = Some(port); }
        if let Some(ws) = new_web_server { site.web_server = ws; }
        final_root = site.root.clone();
        final_runtime = site.runtime.clone();
        final_name = site.name.clone();
    }

    // 停止旧进程（如果运行时改了，在 site 引用释放后操作）
    if params.runtime.is_some() || params.runtime_version_id.is_some() {
        if let Some(proc) = store.site_processes.remove(&site_id) {
            if let Some(pid) = proc.pid {
                let _ = crate::stack::process_util::kill_pid(pid);
            }
            let start = std::time::Instant::now();
            while is_port_listening(proc.port) {
                if start.elapsed() > std::time::Duration::from_secs(5) { break; }
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
        }
    }

    let site_root = resolve_site_root(&install_root, &final_root);
    if site_root.exists() {
        let site_ref = &store.sites[idx];
        crate::stack::www::ensure_site_scaffold(&site_root, site_ref)?;
    }

    let site_clone = store.sites[idx].clone();
    crate::stack::site_runtime::apply_site_version_pref(&mut store, &site_clone);
    save_store(&store)?;

    Ok(site_clone)
}

pub fn delete_site(site_id: &str) -> Result<(), String> {
    let mut store = load_store();
    let idx = store
        .sites
        .iter()
        .position(|s| s.id == site_id)
        .ok_or_else(|| format!("站点不存在: {site_id}"))?;

    if store.sites.len() <= 1 {
        return Err("至少保留一个站点".into());
    }

    let removed = store.sites.remove(idx);
    if removed.is_default {
        if let Some(first) = store.sites.first_mut() {
            first.is_default = true;
            store.settings.www_subdir = first.root.clone();
        }
    }
    save_store(&store)?;
    let _ = remove_entry(&removed.hostname, &removed.id);
    Ok(())
}

pub fn set_default_site(site_id: &str) -> Result<(), String> {
    let mut store = load_store();
    if !store.sites.iter().any(|s| s.id == site_id) {
        return Err(format!("站点不存在: {site_id}"));
    }
    let mut root = None;
    for site in &mut store.sites {
        site.is_default = site.id == site_id;
        if site.is_default {
            root = Some(site.root.clone());
        }
    }
    if let Some(r) = root {
        store.settings.www_subdir = r;
    }
    save_store(&store)
}

pub fn site_url(store: &StackStore, site: &WebSite) -> Option<String> {
    let install = web_install(store, &site.web_server)?;
    Some(format!("http://{}:{}/", site.hostname, install.port))
}

pub fn web_server_detail_label(store: &StackStore, web_server_id: &str) -> String {
    let name = web_display_name(web_server_id);
    match web_install(store, web_server_id) {
        Some(install) => {
            let ver = install.version_label.rsplit(' ').next().unwrap_or(&install.version_label);
            format!("{name} · {ver}")
        }
        None => format!("{name} · 未安装"),
    }
}

pub fn web_server_port_label(store: &StackStore, web_server_id: &str) -> Option<String> {
    web_install(store, web_server_id).map(|i| format!(":{} ", i.port).trim().to_string())
}

pub fn web_server_running(store: &StackStore, web_server_id: &str) -> bool {
    web_install(store, web_server_id)
        .map(|i| is_port_listening(i.port))
        .unwrap_or(false)
}

pub fn sites_for_web_server<'a>(store: &'a StackStore, web_server_id: &str) -> Vec<&'a WebSite> {
    enabled_sites(store)
        .into_iter()
        .filter(|s| s.web_server == web_server_id)
        .collect()
}

pub fn open_site(site_id: Option<&str>) -> Result<(), String> {
    let store = load_store();
    let site = if let Some(id) = site_id {
        store
            .sites
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| format!("站点不存在: {id}"))?
    } else {
        store
            .sites
            .iter()
            .find(|s| s.is_default)
            .or_else(|| store.sites.first())
            .ok_or("尚未配置任何站点")?
    };
    let web_id = site.web_server.as_str();
    let web = web_install(&store, web_id).ok_or_else(|| {
        format!(
            "站点绑定的 {} 尚未安装",
            web_display_name(web_id)
        )
    })?;
    if !is_port_listening(web.port) {
        return Err(format!(
            "请先启动 {}（端口 {}）",
            web_display_name(web_id),
            web.port
        ));
    }
    let url = format!("http://{}:{}/", site.hostname, web.port);
    open::that(url).map_err(|e| format!("{}: {e}", web_display_name(web_id)))
}

pub fn open_site_root(site_id: &str) -> Result<(), String> {
    let store = load_store();
    let install_root = require_install_root()?;
    let site = store
        .sites
        .iter()
        .find(|s| s.id == site_id)
        .ok_or_else(|| format!("站点不存在: {site_id}"))?;
    let root = resolve_site_root(&install_root, &site.root);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    open::that(root).map_err(|e| e.to_string())
}

pub fn pick_site_root() -> Result<Option<String>, String> {
    let store = load_store();
    let root = store.install_root.as_ref().ok_or("尚未设置安装目录")?;
    let picked = rfd::FileDialog::new()
        .set_title("选择站点根目录")
        .set_directory(root)
        .pick_folder();
    Ok(picked.map(|p| {
        let root_path = Path::new(root);
        if let Ok(rel) = p.strip_prefix(root_path) {
            rel.to_string_lossy().replace('\\', "/")
        } else {
            p.to_string_lossy().into_owned()
        }
    }))
}

pub fn enabled_sites(store: &StackStore) -> Vec<&WebSite> {
    store.sites.iter().filter(|s| s.enabled).collect()
}

pub fn resolve_site_path(install_root: &Path, site: &WebSite) -> PathBuf {
    resolve_site_root(install_root, &site.root)
}

// ── 站点运行时进程管理 ──

/// 需要独立进程端口的运行时
const PROCESS_RUNTIMES: &[&str] = &["go", "python", "node"];

/// 站点进程端口范围
const SITE_PORT_RANGE_START: u16 = 8100;
const SITE_PORT_RANGE_END: u16 = 8199;

/// 是否为需要独立进程的运行时
pub fn runtime_needs_process(runtime: &str) -> bool {
    PROCESS_RUNTIMES.contains(&runtime)
}

/// 为站点分配一个未被占用的端口
pub fn assign_site_port(store: &StackStore) -> u16 {
    let used: Vec<u16> = store
        .sites
        .iter()
        .filter_map(|s| s.port)
        .chain(store.site_processes.values().map(|p| p.port))
        .collect();

    for port in SITE_PORT_RANGE_START..=SITE_PORT_RANGE_END {
        if !used.contains(&port) && !is_port_listening(port) {
            return port;
        }
    }
    // 如果范围内全被占用，返回范围外的第一个空闲端口
    for port in SITE_PORT_RANGE_END + 1..SITE_PORT_RANGE_END + 200 {
        if !used.contains(&port) && !is_port_listening(port) {
            return port;
        }
    }
    SITE_PORT_RANGE_START // 最终 fallback
}

/// 启动站点运行时进程
pub fn start_site_process(site_id: &str) -> Result<(), String> {
    let mut store = load_store();
    let install_root = require_install_root()?;

    // 第一阶段：收集所有必要数据（不可变借用）
    let site_idx = store
        .sites
        .iter()
        .position(|s| s.id == site_id)
        .ok_or_else(|| format!("站点不存在: {site_id}"))?;

    let site_runtime = store.sites[site_idx].runtime.clone();
    let site_root_rel = store.sites[site_idx].root.clone();
    let site_name = store.sites[site_idx].name.clone();

    if !runtime_needs_process(&site_runtime) {
        return Err(format!("{site_runtime} 站点无需独立启动进程"));
    }

    // 检查是否已在运行
    if let Some(proc) = store.site_processes.get(site_id) {
        if proc.pid.map_or(false, |pid| crate::stack::process_util::is_pid_running(pid)) {
            if is_port_listening(proc.port) {
                return Ok(());
            }
        }
        store.site_processes.remove(site_id);
    }

    // 分配端口
    let existing_port = store.sites[site_idx].port;
    let port = existing_port.unwrap_or_else(|| assign_site_port(&store));

    // 第二阶段：可变借用 - 写入端口
    store.sites[site_idx].port = Some(port);

    let site_root = resolve_site_root(&install_root, &site_root_rel);
    if !site_root.exists() {
        fs::create_dir_all(&site_root).map_err(|e| e.to_string())?;
    }

    // 确保 scaffold 存在
    {
        let site_ref = &store.sites[site_idx];
        crate::stack::www::ensure_site_scaffold(&site_root, site_ref)?;
    }

    let child = match site_runtime.as_str() {
        "go" => {
            let go_install = store.go.as_ref().ok_or("Go 尚未安装，请先在 Packages 中安装")?;
            let go_exe = Path::new(&go_install.home_dir).join("bin").join("go.exe");
            if !go_exe.exists() {
                return Err(format!("Go 可执行文件不存在: {}", go_exe.display()));
            }
            Command::new(&go_exe)
                .arg("run")
                .arg("main.go")
                .current_dir(&site_root)
                .env("PORT", port.to_string())
                .env("GOROOT", &go_install.home_dir)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("启动 Go 进程失败: {e}"))?
        }
        "python" => {
            let py_install = store.python.as_ref().ok_or("Python 尚未安装，请先在 Packages 中安装")?;
            let python_exe = {
                let exe = Path::new(&py_install.home_dir).join("python.exe");
                if exe.exists() {
                    exe
                } else {
                    let alt = Path::new(&py_install.home_dir).join("python3.exe");
                    if alt.exists() {
                        alt
                    } else {
                        return Err(format!("Python 可执行文件不存在: {}", exe.display()));
                    }
                }
            };
            Command::new(&python_exe)
                .arg("server.py")
                .current_dir(&site_root)
                .env("PORT", port.to_string())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("启动 Python 进程失败: {e}"))?
        }
        _ => return Err(format!("{site_runtime} 站点进程暂不支持")),
    };

    let pid = child.id();

    // 等待端口就绪
    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(15);
    loop {
        if is_port_listening(port) {
            break;
        }
        if start.elapsed() > timeout {
            let _ = crate::stack::process_util::kill_pid(pid);
            return Err(format!(
                "站点 {site_name} 启动超时（端口 {port} 未监听），请检查 main.go 是否正确"
            ));
        }
        if !crate::stack::process_util::is_pid_running(pid) {
            return Err(format!(
                "站点 {site_name} 进程已退出，请检查 main.go 代码。提示：在站点目录运行 `go run main.go` 排查"
            ));
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    store.site_processes.insert(
        site_id.to_string(),
        SiteProcess {
            site_id: site_id.to_string(),
            port,
            pid: Some(pid),
        },
    );

    save_store(&store)?;

    let _ = reload_web_servers(&store);

    Ok(())
}

/// 停止站点运行时进程
pub fn stop_site_process(site_id: &str) -> Result<(), String> {
    let mut store = load_store();

    let proc = store
        .site_processes
        .remove(site_id)
        .ok_or_else(|| format!("站点 {site_id} 进程未在运行"))?;

    if let Some(pid) = proc.pid {
        crate::stack::process_util::kill_pid(pid)?;
    }

    // 等待端口释放
    let start = std::time::Instant::now();
    while is_port_listening(proc.port) {
        if start.elapsed() > std::time::Duration::from_secs(5) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    save_store(&store)?;

    // 重载 Nginx 配置
    let _ = reload_web_servers(&store);

    Ok(())
}

/// 重载所有已运行的 Web 服务器配置
fn reload_web_servers(store: &StackStore) -> Result<(), String> {
    if let Some(nginx) = &store.nginx {
        let _ = crate::stack::nginx::reload_if_running(nginx);
    }
    if let Some(openresty) = &store.openresty {
        let _ = crate::stack::openresty::reload_if_running(openresty);
    }
    Ok(())
}

/// 同步孤儿进程状态：应用重启后，Go 等子进程可能仍在运行但 site_processes 中没有记录。
/// 通过端口检测恢复进程追踪状态。
pub fn sync_orphan_site_processes(store: &mut StackStore) {
    for site in &store.sites {
        if !runtime_needs_process(&site.runtime) {
            continue;
        }
        let Some(port) = site.port else { continue };
        if !is_port_listening(port) {
            // 端口没在监听，清理残留记录
            store.site_processes.remove(&site.id);
            continue;
        }
        // 端口在监听，检查是否有记录
        if let Some(proc) = store.site_processes.get(&site.id) {
            if proc.pid.map_or(false, |pid| crate::stack::process_util::is_pid_running(pid)) {
                continue; // 正常运行中
            }
        }
        // 端口在监听但没有有效记录 → 尝试找 PID 并恢复
        let pid = crate::stack::process_util::find_pid_by_port(port);
        log::info!(
            "检测到站点 {} 端口 {} 在监听，恢复进程追踪 (PID: {:?})",
            site.id,
            port,
            pid
        );
        store.site_processes.insert(
            site.id.clone(),
            SiteProcess {
                site_id: site.id.clone(),
                port,
                pid,
            },
        );
    }
}

/// 启动所有需要进程的站点（start_all 时调用）
pub fn start_all_site_processes(store: &StackStore) {
    for site in &store.sites {
        if !runtime_needs_process(&site.runtime) {
            continue;
        }
        if let Some(proc) = store.site_processes.get(&site.id) {
            if proc.pid.map_or(false, |pid| crate::stack::process_util::is_pid_running(pid))
                && is_port_listening(proc.port)
            {
                continue; // 已在运行
            }
        }
        log::info!("自动启动站点进程: {}", site.id);
        if let Err(err) = start_site_process(&site.id) {
            log::warn!("站点 {} 启动失败: {err}", site.id);
        }
    }
}

pub fn stop_all_site_processes(store: &mut StackStore) {
    let site_ids: Vec<String> = store.site_processes.keys().cloned().collect();
    for site_id in site_ids {
        log::info!("停止站点进程: {site_id}");
        if let Err(err) = stop_site_process(&site_id) {
            log::warn!("站点 {} 停止失败: {err}", site_id);
        }
    }
}

fn slugify(name: &str) -> String {
    let mut slug = String::new();
    let mut prev_dash = false;
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash {
            slug.push('-');
            prev_dash = true;
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        format!(
            "site-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        )
    } else {
        slug
    }
}
