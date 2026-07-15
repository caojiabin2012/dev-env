use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::download::is_downloaded_for_store;
use crate::stack::manifest;
use crate::stack::types::{ComponentVersionStatus, DbEngine, StackSettings, StackStore};

pub fn stack_store_path() -> PathBuf {
    crate::app_paths::app_data_dir().join("stack").join("stack-env.json")
}

pub fn load_store() -> StackStore {
    let path = stack_store_path();
    let _ = crate::stack::db::migrate_to_json_if_needed(&path);

    let raw = fs::read_to_string(&path).ok();
    let mut store = raw
        .as_deref()
        .and_then(|text| serde_json::from_str::<StackStore>(text).ok())
        .unwrap_or_default();

    if let Some(text) = raw.as_deref() {
        migrate_legacy_autostart(text, &mut store);
    }
    if store.install_root.as_deref() == Some("") {
        store.install_root = None;
    }
    migrate_legacy_mariadb(&mut store);
    crate::stack::sites::ensure_default_site(&mut store);
    sync_version_statuses_from_store(&mut store);
    store
}

fn migrate_legacy_autostart(raw: &str, store: &mut StackStore) {
    if !store.settings.boot_autostart.is_empty() { return; }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else { return; };
    let Some(settings) = value.get("settings") else { return; };
    let la = settings.get("autostart_app").and_then(|v| v.as_bool()).unwrap_or(false);
    let ls = settings.get("autostart_services").and_then(|v| v.as_bool()).unwrap_or(false);
    if la && ls && store.settings.boot_autostart.is_empty() {
        store.settings.boot_autostart = crate::stack::types::all_boot_autostart_map(true);
    }
}

pub fn save_store(store: &StackStore) -> Result<(), String> {
    let mut store = store.clone();
    if store.install_root.as_deref() == Some("") {
        store.install_root = None;
    }
    migrate_legacy_mariadb(&mut store);
    crate::stack::sites::ensure_default_site(&mut store);
    sync_version_statuses_from_store(&mut store);

    let path = stack_store_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn require_install_root() -> Result<PathBuf, String> {
    let store = load_store();
    store.install_root.as_ref().ok_or_else(|| "请先设置环境安装目录".into()).map(PathBuf::from)
}

fn migrate_legacy_mariadb(store: &mut StackStore) {
    if store.mariadb.is_some() { return; }
    if let Some(mysql) = store.mysql.as_ref() {
        if mysql.engine == DbEngine::MariaDb { store.mariadb = store.mysql.take(); }
    }
}

pub fn downloads_dir(install_root: &Path) -> PathBuf { install_root.join("downloads") }
pub fn db_paths(install_root: &Path, component: &str) -> (PathBuf, PathBuf, PathBuf) {
    let base = install_root.join(component);
    (base.join("my.ini"), base.join("data"), base.join("logs"))
}
pub fn mysql_paths(install_root: &Path, engine: DbEngine) -> (PathBuf, PathBuf, PathBuf) {
    db_paths(install_root, match engine { DbEngine::Mysql => "mysql", DbEngine::MariaDb => "mariadb" })
}
pub fn nginx_conf_path(install_root: &Path) -> PathBuf { install_root.join("nginx").join("devtools-nginx.conf") }
pub fn nginx_runtime_conf_path(home_dir: &Path) -> PathBuf { home_dir.join("devtools-nginx.conf") }
pub fn apache_runtime_conf_path(home_dir: &Path) -> PathBuf { home_dir.join("devtools-apache.conf") }
pub fn php_ini_path(install_root: &Path) -> PathBuf { install_root.join("php").join("devtools-php.ini") }
pub fn php_runtime_ini_path(home_dir: &Path) -> PathBuf { home_dir.join("devtools-php.ini") }
pub fn redis_conf_path(install_root: &Path) -> PathBuf { install_root.join("redis").join("devtools-redis.conf") }
pub fn redis_runtime_conf_path(home_dir: &Path) -> PathBuf { home_dir.join("devtools-redis.conf") }
pub fn rabbitmq_conf_path(install_root: &Path) -> PathBuf { install_root.join("rabbitmq").join("devtools-rabbitmq.conf") }
pub fn rabbitmq_config_file_base(install_root: &Path) -> PathBuf { install_root.join("rabbitmq").join("devtools-rabbitmq") }
pub fn resolve_site_root(install_root: &Path, subdir: &str) -> PathBuf {
    let sub = subdir.trim().trim_matches(['/', '\\']);
    if sub.is_empty() { install_root.join("www").join("default") }
    else { install_root.join(sub.replace('/', std::path::MAIN_SEPARATOR_STR)) }
}
pub fn resolve_www_root(install_root: &Path, settings: &StackSettings) -> PathBuf { resolve_site_root(install_root, &settings.www_subdir) }
pub fn www_root(install_root: &Path) -> PathBuf {
    let store = load_store();
    if let Some(site) = store.sites.iter().find(|s| s.is_default).or_else(|| store.sites.first()) {
        return resolve_site_root(install_root, &site.root);
    }
    resolve_www_root(install_root, &store.settings)
}
pub fn selected_version_id(component: &str) -> Result<String, String> {
    let store = load_store();
    if let Some(id) = store.version_prefs.get(component) {
        if crate::stack::manifest::find_version(component, id).is_ok() { return Ok(id.clone()); }
    }
    Ok(crate::stack::manifest::default_version_id(component)?.to_string())
}
pub fn set_version_pref(component: &str, version_id: &str) -> Result<(), String> {
    crate::stack::manifest::find_version(component, version_id)?;
    let mut store = load_store();
    store.version_prefs.insert(component.to_string(), version_id.to_string());
    save_store(&store)
}
pub fn zip_cache_path_for(_component: &str, filename: &str) -> Result<PathBuf, String> { Ok(downloads_dir(&require_install_root()?).join(filename)) }
pub fn zip_cache_path_for_store(store: &StackStore, filename: &str) -> Result<PathBuf, String> {
    let root = store.install_root.as_ref().ok_or_else(|| "请先设置环境安装目录".to_string())?;
    Ok(downloads_dir(Path::new(root)).join(filename))
}

/// 从磁盘安装记录 + 下载缓存同步版本状态。
pub fn sync_version_statuses_from_store(store: &mut StackStore) {
    let mut map: std::collections::HashMap<(String, String), ComponentVersionStatus> = store
        .version_statuses
        .drain(..)
        .map(|s| ((s.component_id.clone(), s.version_id.clone()), s))
        .collect();

    for comp in manifest::WINDOWS_COMPONENTS {
        let installed_label = current_install_label(store, comp.id);
        let installed_home = current_install_home(store, comp.id);
        let installed_port = current_install_port(store, comp.id);

        let active_vid = if installed_label.is_some() {
            store
                .version_prefs
                .get(comp.id)
                .filter(|id| comp.versions.iter().any(|v| v.id == id.as_str()))
                .cloned()
                .or_else(|| {
                    installed_label.as_ref().and_then(|label| {
                        comp.versions
                            .iter()
                            .find(|v| label.contains(v.id) || label == v.label)
                            .map(|v| v.id.to_string())
                    })
                })
                .unwrap_or_else(|| comp.default_version_id.to_string())
        } else {
            store
                .version_prefs
                .get(comp.id)
                .cloned()
                .unwrap_or_else(|| comp.default_version_id.to_string())
        };

        for ver in comp.versions {
            let key = (comp.id.to_string(), ver.id.to_string());
            let downloaded = is_downloaded_for_store(store, comp.id, ver.id);
            let is_this_installed = installed_label.is_some() && active_vid == ver.id;

            let entry = map.entry(key).or_insert_with(|| ComponentVersionStatus {
                component_id: comp.id.to_string(),
                version_id: ver.id.to_string(),
                version_label: ver.label.to_string(),
                downloaded: false,
                installed: false,
                is_active: false,
                home_dir: None,
                port: 0,
            });
            entry.version_label = ver.label.to_string();
            entry.downloaded = downloaded || entry.downloaded;
            if is_this_installed {
                entry.installed = true;
                entry.is_active = true;
                entry.home_dir = installed_home.clone();
                entry.port = installed_port;
            } else if installed_label.is_some() {
                entry.is_active = false;
                if entry.home_dir.is_none() {
                    entry.installed = false;
                }
            } else {
                entry.installed = false;
                entry.is_active = false;
                entry.home_dir = None;
                entry.port = 0;
            }
        }
    }

    store.version_statuses = map.into_values().collect();
    store.version_statuses.sort_by(|a, b| {
        a.component_id
            .cmp(&b.component_id)
            .then_with(|| a.version_id.cmp(&b.version_id))
    });
}

fn current_install_label(store: &StackStore, id: &str) -> Option<String> {
    match id {
        "mysql" => store.mysql.as_ref().map(|c| c.version_label.clone()),
        "mariadb" => store.mariadb.as_ref().map(|c| c.version_label.clone()),
        "nginx" => store.nginx.as_ref().map(|c| c.version_label.clone()),
        "openresty" => store.openresty.as_ref().map(|c| c.version_label.clone()),
        "caddy" => store.caddy.as_ref().map(|c| c.version_label.clone()),
        "php" => store.php.as_ref().map(|c| c.version_label.clone()),
        "composer" => store.composer.as_ref().map(|c| c.version_label.clone()),
        "python" => store.python.as_ref().map(|c| c.version_label.clone()),
        "pip" => store.pip.as_ref().map(|c| c.version_label.clone()),
        "go" => store.go.as_ref().map(|c| c.version_label.clone()),
        "java" => store.java.as_ref().map(|c| c.version_label.clone()),
        "node" => store.node.as_ref().map(|c| c.version_label.clone()),
        "npm" => store.npm.as_ref().map(|c| c.version_label.clone()),
        "redis" => store.redis.as_ref().map(|c| c.version_label.clone()),
        "rabbitmq" => store.rabbitmq.as_ref().map(|c| c.version_label.clone()),
        "kafka" => store.kafka.as_ref().map(|c| c.version_label.clone()),
        "rocketmq" => store.rocketmq.as_ref().map(|c| c.version_label.clone()),
        _ => None,
    }
}

fn current_install_home(store: &StackStore, id: &str) -> Option<String> {
    match id {
        "mysql" => store.mysql.as_ref().map(|c| c.home_dir.clone()),
        "mariadb" => store.mariadb.as_ref().map(|c| c.home_dir.clone()),
        "nginx" => store.nginx.as_ref().map(|c| c.home_dir.clone()),
        "openresty" => store.openresty.as_ref().map(|c| c.home_dir.clone()),
        "caddy" => store.caddy.as_ref().map(|c| c.home_dir.clone()),
        "php" => store.php.as_ref().map(|c| c.home_dir.clone()),
        "composer" => store.composer.as_ref().map(|c| c.home_dir.clone()),
        "python" => store.python.as_ref().map(|c| c.home_dir.clone()),
        "pip" => store.pip.as_ref().map(|c| c.home_dir.clone()),
        "go" => store.go.as_ref().map(|c| c.home_dir.clone()),
        "java" => store.java.as_ref().map(|c| c.home_dir.clone()),
        "node" => store.node.as_ref().map(|c| c.home_dir.clone()),
        "npm" => store.npm.as_ref().map(|c| c.home_dir.clone()),
        "redis" => store.redis.as_ref().map(|c| c.home_dir.clone()),
        "rabbitmq" => store.rabbitmq.as_ref().map(|c| c.home_dir.clone()),
        "kafka" => store.kafka.as_ref().map(|c| c.home_dir.clone()),
        "rocketmq" => store.rocketmq.as_ref().map(|c| c.home_dir.clone()),
        _ => None,
    }
}

fn current_install_port(store: &StackStore, id: &str) -> u16 {
    match id {
        "mysql" => store.mysql.as_ref().map(|c| c.port).unwrap_or(0),
        "mariadb" => store.mariadb.as_ref().map(|c| c.port).unwrap_or(0),
        "nginx" => store.nginx.as_ref().map(|c| c.port).unwrap_or(0),
        "openresty" => store.openresty.as_ref().map(|c| c.port).unwrap_or(0),
        "caddy" => store.caddy.as_ref().map(|c| c.port).unwrap_or(0),
        "php" => store.php.as_ref().map(|c| c.port).unwrap_or(0),
        "redis" => store.redis.as_ref().map(|c| c.port).unwrap_or(0),
        "rabbitmq" => store.rabbitmq.as_ref().map(|c| c.port).unwrap_or(0),
        "kafka" => store.kafka.as_ref().map(|c| c.port).unwrap_or(0),
        "rocketmq" => store.rocketmq.as_ref().map(|c| c.port).unwrap_or(0),
        _ => 0,
    }
}
