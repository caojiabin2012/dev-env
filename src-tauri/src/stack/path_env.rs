use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::stack::store::load_store;
use crate::stack::types::{is_cli_component, supports_path_env, StackStore};

fn exe_names_for_component(component: &str) -> &'static [&'static str] {
    match component {
        "nginx" => &["nginx.exe"],
        "openresty" => &["nginx.exe", "openresty.exe"],
        "php" => &["php.exe"],
        "mysql" | "mariadb" => &["mysql.exe", "mysqld.exe"],
        "redis" => &["redis-server.exe", "redis-cli.exe"],
        "rabbitmq" => &["rabbitmq-server.bat", "rabbitmqctl.bat"],
        "composer" => &["composer.bat", "composer.phar"],
        "python" => &["python.exe"],
        "pip" => &["pip.exe", "pip3.exe"],
        "go" => &["go.exe"],
        "java" => &["java.exe", "javac.exe"],
        "node" => &["node.exe"],
        _ => &[],
    }
}

fn normalize_path_key(path: &str) -> String {
    Path::new(path.trim().trim_matches('"'))
        .to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

fn paths_equal(a: &str, b: &str) -> bool {
    normalize_path_key(a) == normalize_path_key(b)
}

fn parse_path_list(raw: &str) -> Vec<String> {
    raw.split(';')
        .map(|s| s.trim().trim_matches('"'))
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

#[cfg(target_os = "windows")]
fn read_user_path_entries() -> Result<Vec<String>, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let env = hkcu.open_subkey("Environment").map_err(|e| format!("读取用户 PATH 失败: {e}"))?;
    let raw: String = env.get_value("Path").or_else(|_| env.get_value("PATH")).unwrap_or_default();
    Ok(parse_path_list(&raw))
}

#[cfg(target_os = "windows")]
fn write_user_path_entries(entries: &[String]) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let joined = entries.join(";");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (env, _) = hkcu.create_subkey("Environment").map_err(|e| format!("写入用户 PATH 失败: {e}"))?;
    env.set_value("Path", &joined).map_err(|e| format!("写入用户 PATH 失败: {e}"))?;
    broadcast_env_change();
    Ok(())
}

#[cfg(target_os = "windows")]
fn read_system_path_entries() -> Result<Vec<String>, String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let env = hklm.open_subkey_with_flags(
        r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", KEY_READ,
    ).map_err(|e| format!("读取系统 PATH 失败: {e}"))?;
    let raw: String = env.get_value("Path").or_else(|_| env.get_value("PATH")).unwrap_or_default();
    Ok(parse_path_list(&raw))
}

#[cfg(target_os = "windows")]
fn remove_from_system_path(remove_keys: &HashSet<String>) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let (env, _) = hklm.create_subkey_with_flags(
        r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", KEY_READ | KEY_WRITE,
    ).map_err(|e| format!("写入系统 PATH 失败（需要管理员权限）: {e}"))?;
    let raw: String = env.get_value("Path").or_else(|_| env.get_value("PATH")).unwrap_or_default();
    let mut entries = parse_path_list(&raw);
    let before = entries.len();
    entries.retain(|e| !remove_keys.contains(&normalize_path_key(e)));
    if entries.len() == before { return Ok(()); }
    let joined = entries.join(";");
    env.set_value("Path", &joined).map_err(|e| format!("写入系统 PATH 失败: {e}"))?;
    broadcast_env_change();
    Ok(())
}

#[cfg(target_os = "windows")]
fn broadcast_env_change() {
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};
    use windows::core::w;
    unsafe {
        let _ = SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, WPARAM(0), LPARAM(w!("Environment").as_ptr() as _), SMTO_ABORTIFHUNG, 1000, None);
    }
}

#[cfg(not(target_os = "windows"))]
fn read_user_path_entries() -> Result<Vec<String>, String> { Err("当前系统不支持修改环境变量".into()) }
#[cfg(not(target_os = "windows"))]
fn write_user_path_entries(_entries: &[String]) -> Result<(), String> { Err("当前系统不支持修改环境变量".into()) }
#[cfg(not(target_os = "windows"))]
fn read_system_path_entries() -> Result<Vec<String>, String> { Ok(vec![]) }
#[cfg(not(target_os = "windows"))]
fn remove_from_system_path(_remove_keys: &HashSet<String>) -> Result<(), String> { Ok(()) }

pub fn component_path_dirs(store: &StackStore, component: &str) -> Result<Vec<PathBuf>, String> {
    if !supports_path_env(component) {
        return Err(format!("{component} 不支持加入环境变量"));
    }
    if component == "npm" {
        return Err("npm 随 Node.js 版本管理，请使用 Node.js 的环境变量".into());
    }
    let root = store.install_root.as_ref().ok_or("尚未设置安装目录")?;
    let install_root = Path::new(root);
    match component {
        "nginx" => { let home = store.nginx.as_ref().ok_or("Nginx 尚未安装")?; Ok(vec![PathBuf::from(&home.home_dir)]) }
        "openresty" => { let home = store.openresty.as_ref().ok_or("OpenResty 尚未安装")?; Ok(vec![PathBuf::from(&home.home_dir)]) }
        "php" => { let home = store.php.as_ref().ok_or("PHP 尚未安装")?; Ok(vec![PathBuf::from(&home.home_dir)]) }
        "mysql" => { let home = store.mysql.as_ref().ok_or("MySQL 尚未安装")?; Ok(vec![Path::new(&home.home_dir).join("bin")]) }
        "mariadb" => { let home = store.mariadb.as_ref().ok_or("MariaDB 尚未安装")?; Ok(vec![Path::new(&home.home_dir).join("bin")]) }
        "redis" => { let home = store.redis.as_ref().ok_or("Redis 尚未安装")?; Ok(vec![PathBuf::from(&home.home_dir)]) }
        "rabbitmq" => {
            let install = store.rabbitmq.as_ref().ok_or("RabbitMQ 尚未安装")?;
            let mut dirs = vec![Path::new(&install.home_dir).join("sbin"), Path::new(&install.erlang_home).join("bin")];
            dirs.retain(|p| p.exists());
            if dirs.is_empty() { return Err("RabbitMQ 可执行目录不存在".into()); }
            Ok(dirs)
        }
        c if is_cli_component(c) => Ok(vec![install_root.join("bin")]),
        _ => Err(format!("未知组件: {component}")),
    }
}

fn all_managed_path_keys(store: &StackStore) -> HashSet<String> {
    let mut keys = HashSet::new();
    for id in crate::stack::types::PATH_ENV_COMPONENT_IDS {
        if let Ok(dirs) = component_path_dirs(store, id) {
            for dir in dirs { keys.insert(normalize_path_key(&dir.to_string_lossy())); }
        }
    }
    keys
}

struct ConflictResult {
    user_conflicts: Vec<String>,
    system_conflicts: Vec<String>,
}

fn find_conflicting_entries(store: &StackStore, component: &str) -> ConflictResult {
    let exe_names = exe_names_for_component(component);
    if exe_names.is_empty() { return ConflictResult { user_conflicts: vec![], system_conflicts: vec![] }; }
    let managed = all_managed_path_keys(store);
    let is_conflict = |entry: &String| -> bool {
        let key = normalize_path_key(entry);
        if managed.contains(&key) { return false; }
        exe_names.iter().any(|name| Path::new(entry).join(name).exists())
    };
    let user_conflicts: Vec<String> = read_user_path_entries().unwrap_or_default().iter().filter(|e| is_conflict(e)).cloned().collect();
    let system_conflicts: Vec<String> = read_system_path_entries().unwrap_or_default().iter().filter(|e| is_conflict(e)).cloned().collect();
    ConflictResult { user_conflicts, system_conflicts }
}

fn desired_path_entries(store: &StackStore) -> Result<Vec<String>, String> {
    let mut desired = Vec::new();
    let mut seen = HashSet::new();
    for (component, enabled) in &store.settings.path_env {
        if !*enabled { continue; }
        for dir in component_path_dirs(store, component)? {
            let text = dir.to_string_lossy().into_owned();
            let key = normalize_path_key(&text);
            if seen.insert(key) { desired.push(text); }
        }
    }
    Ok(desired)
}

fn sync_user_path_inner(store: &StackStore, extra_remove_keys: &HashSet<String>) -> Result<(), String> {
    let desired = desired_path_entries(store)?;
    let managed = all_managed_path_keys(store);
    let mut entries = read_user_path_entries()?;
    entries.retain(|entry| {
        let key = normalize_path_key(entry);
        if extra_remove_keys.contains(&key) { return false; }
        !managed.contains(&key) || desired.iter().any(|d| paths_equal(d, entry))
    });
    for dir in desired {
        if !entries.iter().any(|e| paths_equal(e, &dir)) { entries.push(dir); }
    }
    write_user_path_entries(&entries)
}

pub fn sync_user_path(store: &StackStore) -> Result<(), String> {
    sync_user_path_inner(store, &HashSet::new())
}

pub fn is_component_path_enabled(store: &StackStore, component: &str) -> bool {
    store.settings.path_env.get(component).copied().unwrap_or(false)
}

#[derive(Debug, Clone)]
pub struct PathEnvResult {
    pub removed: Vec<String>,
    pub system_blocked: Vec<String>,
}

pub fn set_component_path_env(component: &str, enabled: bool) -> Result<PathEnvResult, String> {
    if !supports_path_env(component) { return Err(format!("{component} 不支持环境变量设置")); }
    let store = load_store();
    component_path_dirs(&store, component)?;
    let mut store = store;
    let mut removed: Vec<String> = vec![];
    let mut system_blocked: Vec<String> = vec![];
    if enabled {
        let conflicts = find_conflicting_entries(&store, component);
        removed.extend(conflicts.user_conflicts);
        if !conflicts.system_conflicts.is_empty() {
            let sys_remove_keys: HashSet<String> = conflicts.system_conflicts.iter().map(|e| normalize_path_key(e)).collect();
            match remove_from_system_path(&sys_remove_keys) {
                Ok(()) => { removed.extend(conflicts.system_conflicts); }
                Err(e) => {
                    log::warn!("无法移除系统 PATH 中的同类软件 ({}): {}。路径: {:?}", component, e, conflicts.system_conflicts);
                    system_blocked = conflicts.system_conflicts;
                }
            }
        }
        store.settings.path_env.insert(component.to_string(), true);
    } else {
        store.settings.path_env.remove(component);
    };
    let extra_remove: HashSet<String> = removed.iter().map(|e| normalize_path_key(e)).collect();
    sync_user_path_inner(&store, &extra_remove)?;
    crate::stack::store::save_store(&store)?;
    Ok(PathEnvResult { removed, system_blocked })
}

pub fn clear_component_path_env(component: &str) -> Result<(), String> {
    let mut store = load_store();
    if store.settings.path_env.remove(component).is_none() { return Ok(()); }
    sync_user_path(&store)?;
    crate::stack::store::save_store(&store)
}
