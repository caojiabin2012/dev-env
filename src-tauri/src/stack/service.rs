use std::path::Path;

use crate::stack::config::sync_configs;
use crate::stack::manifest;
use crate::stack::process_util::is_port_listening;
use crate::stack::store::{db_paths, load_store, require_install_root, resolve_www_root, save_store};
use crate::stack::types::{
    is_cli_component, CliInstall, DbEngine, InstallComponentParams, MysqlInstall, NginxInstall,
    PhpInstall, RabbitMqInstall, RedisInstall, RocketMqInstall, StackEnvInfo,
    UpdateStackSettingsParams,
};

fn cli_tool_err(component: &str, action: &str) -> Result<(), String> {
    let name = manifest::get_component(component).map(|c| c.name.to_string()).unwrap_or_else(|_| component.to_string());
    Err(format!("{name} 是命令行工具，{action}"))
}

fn cli_installed(store: &crate::stack::types::StackStore, component: &str) -> bool {
    match component {
        "composer" => store.composer.is_some(), "python" => store.python.is_some(),
        "pip" => store.pip.is_some(), "go" => store.go.is_some(),
        "java" => store.java.is_some(), "node" => store.node.is_some(),
        "npm" => store.npm.is_some(), _ => false,
    }
}

fn cli_config_path(store: &crate::stack::types::StackStore, component: &str) -> Result<std::path::PathBuf, String> {
    let path = match component {
        "composer" => store.composer.as_ref().map(crate::stack::composer::composer_exe),
        "python" => store.python.as_ref().map(crate::stack::python_runtime::launcher),
        "pip" => store.pip.as_ref().map(crate::stack::pip::launcher),
        "go" => store.go.as_ref().map(crate::stack::go_runtime::launcher),
        "java" => store.java.as_ref().map(crate::stack::java_runtime::launcher),
        "node" => store.node.as_ref().map(crate::stack::node_runtime::launcher),
        "npm" => store.npm.as_ref().map(crate::stack::npm::launcher),
        _ => None,
    }.ok_or_else(|| format!("{component} 尚未安装"))?;
    Ok(path)
}

pub fn install(params: &InstallComponentParams) -> Result<(), String> {
    let (comp, ver) = manifest::resolve_version(&params.component, params.version_id.as_deref())?;
    let port = params.port.unwrap_or(comp.default_port);
    let source = params.source_path.as_deref();
    let version_id = params.version_id.as_deref();
    match params.component.as_str() {
        "mysql" => { crate::stack::mysql::install::install("mysql", source, port, ver.label, version_id)?; }
        "mariadb" => { crate::stack::mysql::install::install("mariadb", source, port, ver.label, version_id)?; }
        "nginx" => { crate::stack::nginx::install(source, port, ver.label, version_id)?; }
        "openresty" => { crate::stack::openresty::install(source, port, ver.label, version_id)?; }
        "caddy" => { crate::stack::caddy::install(source, port, ver.label, version_id)?; }
        "php" => { crate::stack::php::install(source, port, ver.label, version_id)?; }
        "composer" => { crate::stack::composer::install(source, port, ver.label, version_id)?; }
        "python" => { crate::stack::python_runtime::install(source, port, ver.label, version_id)?; }
        "pip" => { crate::stack::pip::install(source, port, ver.label, version_id)?; }
        "go" => { crate::stack::go_runtime::install(source, port, ver.label, version_id)?; }
        "java" => { crate::stack::java_runtime::install(source, port, ver.label, version_id)?; }
        "node" => { crate::stack::node_runtime::install(source, port, ver.label, version_id)?; }
        "npm" => { crate::stack::npm::install(source, port, ver.label, version_id)?; }
        "redis" => { crate::stack::redis::install(source, port, ver.label, version_id)?; }
        "rabbitmq" => { crate::stack::rabbitmq::install(source, port, ver.label, version_id)?; }
        "rocketmq" => { crate::stack::rocketmq::install(source, port, ver.label, version_id)?; }
        "kafka" => { return Err(format!("{} 目前仍需命令行手动安装/启动", params.component)); }
        _ => return Err(format!("未知组件: {}", params.component)),
    }
    let mut store = load_store();
    store
        .version_prefs
        .insert(params.component.clone(), ver.id.to_string());
    save_store(&store)?;

    let store = load_store();
    if let Some(root) = store.install_root.as_deref() { let _ = sync_configs(&store, Path::new(root)); }
    Ok(())
}

pub fn start(component: &str) -> Result<(), String> {
    match component {
        "mysql" => { crate::stack::mysql::process::start("mysql")?; }
        "mariadb" => { crate::stack::mysql::process::start("mariadb")?; }
        "nginx" => { crate::stack::nginx::start()?; }
        "openresty" => { crate::stack::openresty::start()?; }
        "caddy" => { crate::stack::caddy::start()?; }
        "php" => { crate::stack::php::start()?; }
        c if is_cli_component(c) => return cli_tool_err(c, "无需启动"),
        "redis" => { crate::stack::redis::start()?; }
        "rabbitmq" => { crate::stack::rabbitmq::start()?; }
        "rocketmq" => { crate::stack::rocketmq::start()?; }
        "kafka" => { return Err(format!("{component} 暂不支持自动启动")); }
        _ => return Err(format!("未知组件: {component}")),
    }
    Ok(())
}

pub fn switch_version(component: &str, version_id: &str, restart: bool) -> Result<(), String> {
    let mut store = load_store();
    let target = store
        .version_statuses
        .iter()
        .find(|s| {
            s.component_id == component
                && s.version_id == version_id
                && s.installed
                && s.home_dir.as_ref().is_some_and(|home| !home.is_empty())
        })
        .cloned()
        .ok_or_else(|| format!("{} {} 尚未安装", component_display_name(component), version_id))?;

    let was_running = is_component_running(&store, component)?;
    if was_running {
        stop(component)?;
        store = load_store();
    }

    let install = install_from_version_status(&store, component, &target)?;
    apply_component_install(&mut store, component, install)?;
    store
        .version_prefs
        .insert(component.to_string(), version_id.to_string());

    if let Some(root_str) = store.install_root.as_deref() {
        let _ = sync_configs(&store, Path::new(root_str));
    }
    if crate::stack::path_env::is_component_path_enabled(&store, component) {
        crate::stack::path_env::sync_user_path(&store)?;
    }
    save_store(&store)?;

    if restart || was_running {
        start(component)?;
    }
    Ok(())
}

pub fn stop(component: &str) -> Result<(), String> {
    match component {
        "mysql" => { crate::stack::mysql::process::stop_from_store("mysql")?; }
        "mariadb" => { crate::stack::mysql::process::stop_from_store("mariadb")?; }
        "nginx" => { crate::stack::nginx::stop_from_store()?; }
        "openresty" => { crate::stack::openresty::stop_from_store()?; }
        "caddy" => { crate::stack::caddy::stop_from_store()?; }
        "php" => { crate::stack::php::stop_from_store()?; }
        c if is_cli_component(c) => return cli_tool_err(c, "无需停止"),
        "redis" => { crate::stack::redis::stop_from_store()?; }
        "rabbitmq" => { crate::stack::rabbitmq::stop_from_store()?; }
        "rocketmq" => { crate::stack::rocketmq::stop_from_store()?; }
        "kafka" => { return Err(format!("{component} 暂不支持自动停止")); }
        _ => return Err(format!("未知组件: {component}")),
    }
    Ok(())
}

pub fn uninstall(component: &str) -> Result<(), String> {
    match component {
        "mysql" => crate::stack::mysql::install::uninstall("mysql")?,
        "mariadb" => crate::stack::mysql::install::uninstall("mariadb")?,
        "nginx" => crate::stack::nginx::uninstall()?,
        "openresty" => crate::stack::openresty::uninstall()?,
        "caddy" => crate::stack::caddy::uninstall()?,
        "php" => crate::stack::php::uninstall()?,
        "composer" => crate::stack::composer::uninstall()?,
        "python" => crate::stack::python_runtime::uninstall()?,
        "pip" => crate::stack::pip::uninstall()?,
        "go" => crate::stack::go_runtime::uninstall()?,
        "java" => crate::stack::java_runtime::uninstall()?,
        "node" => crate::stack::node_runtime::uninstall()?,
        "npm" => crate::stack::npm::uninstall()?,
        "redis" => crate::stack::redis::uninstall()?,
        "rabbitmq" => crate::stack::rabbitmq::uninstall()?,
        "rocketmq" => crate::stack::rocketmq::uninstall()?,
        "kafka" => return Err(format!("{component} 暂不支持安装")),
        _ => return Err(format!("未知组件: {component}")),
    }
    let _ = crate::stack::path_env::clear_component_path_env(component);
    Ok(())
}

pub fn set_component_path_env(component: &str, enabled: bool) -> Result<crate::stack::path_env::PathEnvResult, String> {
    crate::stack::path_env::set_component_path_env(component, enabled)
}

pub fn start_boot_autostart() -> Result<(), String> {
    let store = crate::stack::store::load_store();
    let mut errors = Vec::new();
    for id in BOOT_START_ORDER {
        if !store.settings.boot_autostart_enabled(id) {
            continue;
        }
        if !is_component_installed(&store, id) {
            continue;
        }
        if let Err(err) = start(id) {
            errors.push(format!("{id}: {err}"));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("\n"))
    }
}

const BOOT_START_ORDER: &[&str] = &["redis", "rabbitmq", "mysql", "mariadb", "php", "nginx", "openresty"];

fn is_component_installed(store: &crate::stack::types::StackStore, id: &str) -> bool {
    match id {
        "mysql" => store.mysql.is_some(), "mariadb" => store.mariadb.is_some(),
        "nginx" => store.nginx.is_some(), "openresty" => store.openresty.is_some(),
        "caddy" => store.caddy.is_some(),
        "php" => store.php.is_some(), "composer" => store.composer.is_some(),
        "python" => store.python.is_some(), "pip" => store.pip.is_some(),
        "go" => store.go.is_some(), "java" => store.java.is_some(),
        "node" => store.node.is_some(),
        "npm" => store.npm.is_some(), "redis" => store.redis.is_some(),
        "rabbitmq" => store.rabbitmq.is_some(), "kafka" => store.kafka.is_some(),
        "rocketmq" => store.rocketmq.is_some(), _ => false,
    }
}

fn sync_os_boot_autostart(settings: &crate::stack::types::StackSettings) -> Result<(), String> { crate::stack::autostart::update_boot_autostart(settings.any_boot_autostart()) }

pub fn set_component_boot_autostart(component: &str, enabled: bool) -> Result<(), String> {
    if !crate::stack::types::BOOT_COMPONENT_IDS.contains(&component) { return Err(format!("不支持开机自启的组件: {component}")); }
    let mut store = load_store();
    if enabled { store.settings.boot_autostart.insert(component.to_string(), true); } else { store.settings.boot_autostart.remove(component); }
    sync_os_boot_autostart(&store.settings)?;
    save_store(&store)
}

pub fn start_all() -> Result<(), String> {
    let mut errors = Vec::new();
    for id in BOOT_START_ORDER { let store = crate::stack::store::load_store(); if !is_component_installed(&store, id) { continue; } if let Err(err) = start(id) { errors.push(format!("{id}: {err}")); } }
    let store = crate::stack::store::load_store(); crate::stack::sites::start_all_site_processes(&store);
    if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) }
}

pub fn stop_all() -> Result<(), String> {
    let mut store = crate::stack::store::load_store(); crate::stack::sites::stop_all_site_processes(&mut store);
    for id in ["nginx", "openresty", "php", "mysql", "mariadb", "rabbitmq", "redis"] { let store = crate::stack::store::load_store(); let installed = match id { "mysql" => store.mysql.is_some(), "mariadb" => store.mariadb.is_some(), "nginx" => store.nginx.is_some(), "openresty" => store.openresty.is_some(), "php" => store.php.is_some(), "redis" => store.redis.is_some(), "rabbitmq" => store.rabbitmq.is_some(), _ => false, }; if installed { let _ = stop(id); } }
    Ok(())
}

pub fn update_settings(params: &UpdateStackSettingsParams) -> Result<(), String> {
    let mut store = load_store(); let mut need_sync = false;
    if let Some(subdir) = params.www_subdir.as_deref() { let t = subdir.trim().trim_matches(['/', '\\']); if t.is_empty() { return Err("网站目录不能为空".into()); } store.settings.www_subdir = t.replace('\\', "/"); need_sync = true; }
    if let Some(b) = &params.boot_autostart { store.settings.boot_autostart = b.clone(); sync_os_boot_autostart(&store.settings)?; }
    if let Some(c) = &params.dashboard_cards { store.settings.dashboard_cards = crate::stack::types::normalize_dashboard_cards(c)?; }
    save_store(&store)?; if need_sync || params.boot_autostart.is_some() { let root = require_install_root()?; sync_configs(&store, &root)?; }
    Ok(())
}

pub fn set_component_port(component: &str, port: u16) -> Result<(), String> {
    if port == 0 { return Err("端口无效".into()); }
    let mut store = load_store(); let root = require_install_root()?; if is_component_running(&store, component)? { return Err("请先停止该服务再修改端口".into()); }
    ensure_port_free(&store, component, port)?;
    match component {
        "mysql" => { store.mysql.as_mut().ok_or("MySQL 尚未安装")?.port = port; }
        "mariadb" => { store.mariadb.as_mut().ok_or("MariaDB 尚未安装")?.port = port; }
        "nginx" => { store.nginx.as_mut().ok_or("Nginx 尚未安装")?.port = port; }
        "openresty" => { store.openresty.as_mut().ok_or("OpenResty 尚未安装")?.port = port; }
        "caddy" => { store.caddy.as_mut().ok_or("Caddy 尚未安装")?.port = port; }
        "php" => { store.php.as_mut().ok_or("PHP 尚未安装")?.port = port; }
        c if is_cli_component(c) => { return Err(format!("{} 无需配置端口", manifest::get_component(c).map(|x| x.name).unwrap_or(c))); }
        "redis" => { store.redis.as_mut().ok_or("Redis 尚未安装")?.port = port; }
        "rabbitmq" => { store.rabbitmq.as_mut().ok_or("RabbitMQ 尚未安装")?.port = port; }
        "rocketmq" | "kafka" => { return Err(format!("{} 暂不支持修改端口", component_display_name(component))); }
        _ => return Err(format!("未知组件: {component}")),
    }
    if crate::stack::path_env::is_component_path_enabled(&store, component) {
        crate::stack::path_env::sync_user_path(&store)?;
    }
    save_store(&store)?; sync_configs(&store, &root)?;
    Ok(())
}

pub fn open_component_config(component: &str) -> Result<(), String> {
    let store = load_store(); let root = store.install_root.as_ref().ok_or("尚未设置安装目录")?; let install_root = Path::new(root);
    let path = match component {
        "mysql" => { store.mysql.as_ref().ok_or("MySQL 尚未安装")?; db_paths(install_root, "mysql").0 }
        "mariadb" => { store.mariadb.as_ref().ok_or("MariaDB 尚未安装")?; db_paths(install_root, "mariadb").0 }
        "nginx" => { let n = store.nginx.as_ref().ok_or("Nginx 尚未安装")?; let p = crate::stack::nginx::runtime_conf_path(n); if !p.exists() { let pp = store.php.as_ref().map(|x| x.port).unwrap_or(9000); let _ = crate::stack::nginx::write_config(n, pp, &store, install_root); } p }
        "openresty" => { let n = store.openresty.as_ref().ok_or("OpenResty 尚未安装")?; let p = crate::stack::openresty::runtime_conf_path(n); if !p.exists() { let pp = store.php.as_ref().map(|x| x.port).unwrap_or(9000); let _ = crate::stack::openresty::write_config(n, pp, &store, install_root); } p }
        "caddy" => { let n = store.caddy.as_ref().ok_or("Caddy 尚未安装")?; let p = crate::stack::caddy::runtime_conf_path(n); if !p.exists() { let pp = store.php.as_ref().map(|x| x.port).unwrap_or(9000); let _ = crate::stack::caddy::write_config(n, pp, &store, install_root); } p }
        "php" => { let p = crate::stack::php::runtime_ini_path(store.php.as_ref().ok_or("PHP 尚未安装")?); if !p.exists() { let _ = crate::stack::php::write_config(install_root, store.php.as_ref().unwrap()); } p }
        "composer" => cli_config_path(&store, "composer")?,
        "python" => cli_config_path(&store, "python")?,
        "pip" => cli_config_path(&store, "pip")?,
        "go" => cli_config_path(&store, "go")?,
        "java" => cli_config_path(&store, "java")?,
        "node" => cli_config_path(&store, "node")?,
        "npm" => cli_config_path(&store, "npm")?,
        "redis" => { let r = store.redis.as_ref().ok_or("Redis 尚未安装")?; let p = crate::stack::redis::runtime_conf_path(r); if !p.exists() { let _ = crate::stack::redis::write_config(install_root, r); } p }
        "rabbitmq" => { let p = crate::stack::rabbitmq::runtime_conf_path(install_root); if !p.exists() { if let Some(r) = store.rabbitmq.as_ref() { let _ = crate::stack::rabbitmq::write_config(install_root, r); } } p }
        _ => return Err(format!("未知组件: {component}")),
    };
    if !path.exists() { return Err(format!("配置文件不存在: {}", path.display())); }
    open::that(path).map_err(|e| e.to_string())
}

pub fn open_component_log(component: &str) -> Result<(), String> {
    use std::fs; let store = load_store(); let root = store.install_root.as_ref().ok_or("尚未设置安装目录")?; let install_root = Path::new(root);
    let path = match component {
        "mysql" => { store.mysql.as_ref().ok_or("MySQL 尚未安装")?; db_paths(install_root, "mysql").2.join("error.log") }
        "mariadb" => { store.mariadb.as_ref().ok_or("MariaDB 尚未安装")?; db_paths(install_root, "mariadb").2.join("error.log") }
        "nginx" => store.nginx.as_ref().map(|n| crate::stack::nginx::log_path(n)).ok_or("Nginx 尚未安装")?,
        "openresty" => store.openresty.as_ref().map(|n| crate::stack::openresty::log_path(n)).ok_or("OpenResty 尚未安装")?,
        "caddy" => store.caddy.as_ref().map(|n| crate::stack::caddy::log_path(n)).ok_or("Caddy 尚未安装")?,
        "php" => crate::stack::php::log_path(install_root),
        c if is_cli_component(c) => { return Err(format!("{} 无独立日志文件", manifest::get_component(c).map(|x| x.name).unwrap_or(c))); }
        "redis" => return Err("Redis 日志请查看数据目录".into()),
        "rabbitmq" => { store.rabbitmq.as_ref().ok_or("RabbitMQ 尚未安装")?; install_root.join("rabbitmq").join("logs").join("rabbitmq.log") }
        _ => return Err(format!("未知组件: {component}")),
    };
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    if !path.exists() { fs::write(&path, "").map_err(|e| e.to_string())?; }
    open::that(path).map_err(|e| e.to_string())
}

pub fn open_site() -> Result<(), String> { crate::stack::sites::open_site(None) }

pub fn build_env_info(store: &crate::stack::types::StackStore) -> StackEnvInfo {
    let www = store.install_root.as_ref().map(|r| resolve_www_root(Path::new(r), &store.settings)).and_then(|p| p.to_str().map(String::from));
    let site_url = crate::stack::sites::preferred_web_server(store).map(|(_, web)| format!("http://127.0.0.1:{}", web.port));
    StackEnvInfo {
        site_url, www_root: www, mysql_host: "127.0.0.1".into(), mysql_port: store.mysql.as_ref().map(|m| m.port),
        mysql_user: "root".into(), mysql_password: String::new(), mariadb_port: store.mariadb.as_ref().map(|m| m.port),
        php_fastcgi: store.php.as_ref().map(|p| format!("127.0.0.1:{}", p.port)),
        composer_cmd: store.composer.as_ref().map(|c| crate::stack::composer::composer_exe(c).to_string_lossy().into_owned()),
        python_cmd: store.python.as_ref().map(|c| crate::stack::python_runtime::launcher(c).to_string_lossy().into_owned()),
        pip_cmd: store.pip.as_ref().map(|c| crate::stack::pip::launcher(c).to_string_lossy().into_owned()),
        go_cmd: store.go.as_ref().map(|c| crate::stack::go_runtime::launcher(c).to_string_lossy().into_owned()),
        java_cmd: store.java.as_ref().map(|c| crate::stack::java_runtime::launcher(c).to_string_lossy().into_owned()),
        node_cmd: store.node.as_ref().map(|c| crate::stack::node_runtime::launcher(c).to_string_lossy().into_owned()),
        npm_cmd: store.npm.as_ref().map(|c| crate::stack::npm::launcher(c).to_string_lossy().into_owned()),
        redis_addr: store.redis.as_ref().map(|r| format!("127.0.0.1:{}", r.port)),
        rabbitmq_addr: store.rabbitmq.as_ref().map(|r| format!("127.0.0.1:{}", r.port)),
        rabbitmq_mgmt_url: store.rabbitmq.as_ref().map(|r| format!("http://127.0.0.1:{}/", r.mgmt_port)),
    }
}

fn is_component_running(store: &crate::stack::types::StackStore, component: &str) -> Result<bool, String> {
    Ok(matches!(match component {
        "mysql" => store.mysql.as_ref().map(|m| crate::stack::mysql::process::status(m)),
        "mariadb" => store.mariadb.as_ref().map(|m| crate::stack::mysql::process::status(m)),
        "nginx" => store.nginx.as_ref().map(|n| crate::stack::nginx::status(n)),
        "openresty" => store.openresty.as_ref().map(|n| crate::stack::openresty::status(n)),
        "caddy" => store.caddy.as_ref().map(|n| crate::stack::caddy::status(n)),
        "php" => store.php.as_ref().map(|p| crate::stack::php::status(p)),
        c if is_cli_component(c) => cli_installed(store, c).then_some(crate::stack::types::ServiceStatus::Stopped),
        "redis" => store.redis.as_ref().map(|r| crate::stack::redis::status(r)),
        "rabbitmq" => store.rabbitmq.as_ref().map(|r| crate::stack::rabbitmq::status(r)),
        "rocketmq" => store.rocketmq.as_ref().map(|r| crate::stack::rocketmq::status(r)),
        _ => return Err(format!("未知组件: {component}")),
    }, Some(crate::stack::types::ServiceStatus::Running)))
}

fn ensure_port_free(store: &crate::stack::types::StackStore, component: &str, port: u16) -> Result<(), String> {
    let conflicts = [("mysql", store.mysql.as_ref().map(|m| m.port)), ("mariadb", store.mariadb.as_ref().map(|m| m.port)), ("nginx", store.nginx.as_ref().map(|n| n.port)), ("openresty", store.openresty.as_ref().map(|n| n.port)), ("caddy", store.caddy.as_ref().map(|n| n.port)), ("php", store.php.as_ref().map(|p| p.port)), ("redis", store.redis.as_ref().map(|r| r.port)), ("rabbitmq", store.rabbitmq.as_ref().map(|r| r.port))];
    for (id, existing) in conflicts { if id == component { continue; } if existing == Some(port) { return Err(format!("端口 {port} 已被 {id} 使用")); } }
    if is_port_listening(port) { return Err(format!("端口 {port} 已被其他程序占用")); }
    Ok(())
}

pub fn component_paths(store: &crate::stack::types::StackStore, component: &str) -> (Option<String>, Option<String>) {
    let Some(root) = store.install_root.as_ref() else { return (None, None); };
    let install_root = Path::new(root);
    match component {
        "mysql" => store.mysql.as_ref().map_or((None, None), |_| { let (conf, _, logs) = db_paths(install_root, "mysql"); (Some(conf.to_string_lossy().into_owned()), Some(logs.join("error.log").to_string_lossy().into_owned())) }),
        "mariadb" => store.mariadb.as_ref().map_or((None, None), |_| { let (conf, _, logs) = db_paths(install_root, "mariadb"); (Some(conf.to_string_lossy().into_owned()), Some(logs.join("error.log").to_string_lossy().into_owned())) }),
        "nginx" => store.nginx.as_ref().map_or((None, None), |n| (Some(crate::stack::nginx::runtime_conf_path(n).to_string_lossy().into_owned()), Some(crate::stack::nginx::log_path(n).to_string_lossy().into_owned()))),
        "openresty" => store.openresty.as_ref().map_or((None, None), |n| (Some(crate::stack::openresty::runtime_conf_path(n).to_string_lossy().into_owned()), Some(crate::stack::openresty::log_path(n).to_string_lossy().into_owned()))),
        "caddy" => store.caddy.as_ref().map_or((None, None), |n| (Some(crate::stack::caddy::runtime_conf_path(n).to_string_lossy().into_owned()), None)),
        "php" => store.php.as_ref().map_or((None, None), |p| (Some(crate::stack::php::runtime_ini_path(p).to_string_lossy().into_owned()), Some(crate::stack::php::log_path(install_root).to_string_lossy().into_owned()))),
        "composer" => store.composer.as_ref().map_or((None, None), |c| (Some(crate::stack::composer::composer_exe(c).to_string_lossy().into_owned()), None)),
        "python" => store.python.as_ref().map_or((None, None), |c| (Some(crate::stack::python_runtime::launcher(c).to_string_lossy().into_owned()), None)),
        "pip" => store.pip.as_ref().map_or((None, None), |c| (Some(crate::stack::pip::launcher(c).to_string_lossy().into_owned()), None)),
        "go" => store.go.as_ref().map_or((None, None), |c| (Some(crate::stack::go_runtime::launcher(c).to_string_lossy().into_owned()), None)),
        "java" => store.java.as_ref().map_or((None, None), |c| (Some(crate::stack::java_runtime::launcher(c).to_string_lossy().into_owned()), None)),
        "node" => store.node.as_ref().map_or((None, None), |c| (Some(crate::stack::node_runtime::launcher(c).to_string_lossy().into_owned()), None)),
        "npm" => store.npm.as_ref().map_or((None, None), |c| (Some(crate::stack::npm::launcher(c).to_string_lossy().into_owned()), None)),
        "redis" => store.redis.as_ref().map_or((None, None), |r| (Some(crate::stack::redis::runtime_conf_path(r).to_string_lossy().into_owned()), None)),
        "rabbitmq" => store.install_root.as_ref().map_or((None, None), |root| { let r = Path::new(root); (Some(crate::stack::rabbitmq::runtime_conf_path(r).to_string_lossy().into_owned()), Some(r.join("rabbitmq").join("logs").to_string_lossy().into_owned())) }),
        _ => (None, None),
    }
}

enum ComponentInstall {
    Mysql(MysqlInstall),
    Nginx(NginxInstall),
    Php(PhpInstall),
    Cli(CliInstall),
    Redis(RedisInstall),
    RabbitMq(RabbitMqInstall),
    RocketMq(RocketMqInstall),
}

fn install_from_version_status(
    store: &crate::stack::types::StackStore,
    component: &str,
    status: &crate::stack::types::ComponentVersionStatus,
) -> Result<ComponentInstall, String> {
    let home_dir = status
        .home_dir
        .clone()
        .filter(|home| !home.is_empty())
        .ok_or_else(|| format!("{} {} 缺少安装目录", component_display_name(component), status.version_id))?;
    let version_label = status.version_label.clone();
    let port = status.port;

    let install = match component {
        "mysql" => ComponentInstall::Mysql(MysqlInstall {
            engine: DbEngine::Mysql,
            version_label,
            home_dir,
            port,
            initialized: store.mysql.as_ref().map(|m| m.initialized).unwrap_or(true),
            pid: None,
            root_password: store.mysql.as_ref().and_then(|m| m.root_password.clone()),
        }),
        "mariadb" => ComponentInstall::Mysql(MysqlInstall {
            engine: DbEngine::MariaDb,
            version_label,
            home_dir,
            port,
            initialized: store.mariadb.as_ref().map(|m| m.initialized).unwrap_or(true),
            pid: None,
            root_password: store.mariadb.as_ref().and_then(|m| m.root_password.clone()),
        }),
        "nginx" | "openresty" | "caddy" | "kafka" => {
            ComponentInstall::Nginx(NginxInstall {
                version_label,
                home_dir,
                port,
                pid: None,
            })
        }
        "rocketmq" => ComponentInstall::RocketMq(RocketMqInstall {
            version_label,
            home_dir,
            port,
            broker_port: 10911,
            pid: None,
            namesrv_pid: None,
        }),
        "php" => ComponentInstall::Php(PhpInstall {
            version_label,
            home_dir,
            port,
            pid: None,
        }),
        "composer" | "python" | "pip" | "go" | "java" | "node" | "npm" => {
            ComponentInstall::Cli(CliInstall {
                version_label,
                home_dir,
            })
        }
        "redis" => ComponentInstall::Redis(RedisInstall {
            version_label,
            home_dir,
            port,
            pid: None,
            password: store.redis.as_ref().and_then(|r| r.password.clone()),
        }),
        "rabbitmq" => {
            let erlang_home = store
                .rabbitmq
                .as_ref()
                .map(|r| r.erlang_home.clone())
                .or_else(|| {
                    store.install_root.as_ref().and_then(|root| {
                        crate::stack::rabbitmq::deps::erlang_home_from_root(&Path::new(root).join("erlang"))
                            .ok()
                            .map(|p| p.to_string_lossy().into_owned())
                    })
                })
                .ok_or("RabbitMQ 缺少 Erlang 运行时，请重新安装 RabbitMQ")?;
            ComponentInstall::RabbitMq(RabbitMqInstall {
                version_label,
                home_dir,
                erlang_home,
                port,
                mgmt_port: store.rabbitmq.as_ref().map(|r| r.mgmt_port).unwrap_or(15672),
                delayed_plugin: store.rabbitmq.as_ref().map(|r| r.delayed_plugin).unwrap_or(false),
                pid: None,
            })
        }
        _ => return Err(format!("{} 暂不支持切换版本", component_display_name(component))),
    };
    Ok(install)
}

fn apply_component_install(
    store: &mut crate::stack::types::StackStore,
    component: &str,
    install: ComponentInstall,
) -> Result<(), String> {
    match (component, install) {
        ("mysql", ComponentInstall::Mysql(install)) => store.mysql = Some(install),
        ("mariadb", ComponentInstall::Mysql(install)) => store.mariadb = Some(install),
        ("nginx", ComponentInstall::Nginx(install)) => store.nginx = Some(install),
        ("openresty", ComponentInstall::Nginx(install)) => store.openresty = Some(install),
        ("caddy", ComponentInstall::Nginx(install)) => store.caddy = Some(install),
        ("kafka", ComponentInstall::Nginx(install)) => store.kafka = Some(install),
        ("rocketmq", ComponentInstall::RocketMq(install)) => store.rocketmq = Some(install),
        ("php", ComponentInstall::Php(install)) => store.php = Some(install),
        ("composer", ComponentInstall::Cli(install)) => store.composer = Some(install),
        ("python", ComponentInstall::Cli(install)) => store.python = Some(install),
        ("pip", ComponentInstall::Cli(install)) => store.pip = Some(install),
        ("go", ComponentInstall::Cli(install)) => store.go = Some(install),
        ("java", ComponentInstall::Cli(install)) => store.java = Some(install),
        ("node", ComponentInstall::Cli(install)) => store.node = Some(install),
        ("npm", ComponentInstall::Cli(install)) => store.npm = Some(install),
        ("redis", ComponentInstall::Redis(install)) => store.redis = Some(install),
        ("rabbitmq", ComponentInstall::RabbitMq(install)) => store.rabbitmq = Some(install),
        _ => return Err(format!("{} 暂不支持切换版本", component_display_name(component))),
    }
    Ok(())
}

fn component_display_name(component: &str) -> String {
    manifest::get_component(component)
        .map(|c| c.name.to_string())
        .unwrap_or_else(|_| component.to_string())
}
