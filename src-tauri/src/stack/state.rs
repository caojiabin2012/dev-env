use crate::stack::download::is_downloaded_for_store;
use crate::stack::manifest;
use crate::stack::process_util::{PortSnapshot, service_status_with_snapshot};
use crate::stack::service::{build_env_info, component_paths};
use crate::stack::site_runtime;
use crate::stack::sites;
use crate::stack::store::{load_store, resolve_site_root, zip_cache_path_for_store};
use crate::stack::types::{cli_prerequisite, ComponentView, ServiceStatus, StackState, StackStore, VersionOption, WebSiteView, CliInstall};

pub fn build_stack_state() -> StackState {
    let mut store = load_store();
    // 同步孤儿进程（应用重启后 Go 子进程可能仍在运行）
    crate::stack::sites::sync_orphan_site_processes(&mut store);
    let settings = store.settings.clone();
    let env_info = build_env_info(&store);
    let port_snapshot = PortSnapshot::capture();
    let components = manifest::WINDOWS_COMPONENTS
        .iter()
        .filter_map(|m| build_component_view(m.id, &store, &port_snapshot).ok())
        .collect();
    let sites = build_site_views(&store);
    StackState {
        install_root: store.install_root.clone(),
        settings,
        env_info,
        components,
        sites,
    }
}

fn build_site_views(store: &StackStore) -> Vec<WebSiteView> {
    let install_root = store.install_root.as_deref().map(std::path::Path::new);
    store
        .sites
        .iter()
        .map(|site| {
            let root_abs = install_root
                .map(|root| resolve_site_root(root, &site.root))
                .and_then(|p| p.to_str().map(String::from));
            let runtime_label = site_runtime::runtime_display(
                &site.runtime,
                site.runtime_version_id.as_deref(),
            );
            let web_server_label =
                crate::stack::sites::web_server_detail_label(store, &site.web_server);
            let web_server_installed =
                crate::stack::sites::web_install(store, &site.web_server).is_some();
            let web_server_running =
                crate::stack::sites::web_server_running(store, &site.web_server);
            let process_running = store
                .site_processes
                .get(&site.id)
                .map_or(false, |p| {
                    p.pid.map_or(false, |pid| {
                        crate::stack::process_util::is_pid_running(pid)
                            && crate::stack::process_util::is_port_listening(p.port)
                    })
                });
            WebSiteView {
                id: site.id.clone(),
                name: site.name.clone(),
                hostname: site.hostname.clone(),
                root: site.root.clone(),
                root_abs,
                enabled: site.enabled,
                is_default: site.is_default,
                url: sites::site_url(store, site),
                runtime: site.runtime.clone(),
                runtime_label,
                runtime_version_id: site.runtime_version_id.clone(),
                web_server: site.web_server.clone(),
                web_server_label,
                web_server_installed,
                web_server_running,
                runtime_ready: site_runtime::site_runtime_ready(store, site),
                port: site.port,
                process_running,
            }
        })
        .collect()
}

fn resolve_selected_version_id(store: &StackStore, component_id: &str) -> Result<String, String> {
    let comp = manifest::get_component(component_id)?;
    if let Some(id) = store.version_prefs.get(component_id) {
        if manifest::find_version(component_id, id).is_ok() {
            return Ok(id.clone());
        }
    }
    Ok(comp.default_version_id.to_string())
}

fn build_component_view(id: &str, store: &StackStore, port_snapshot: &PortSnapshot) -> Result<ComponentView, String> {
    let comp = manifest::get_component(id)?;
    let version_id = resolve_selected_version_id(store, id)?;
    let (_, ver) = manifest::resolve_version(id, Some(&version_id))?;

    let available_versions: Vec<VersionOption> = comp
        .versions
        .iter()
        .map(|v| {
            let status = store.version_statuses.iter().find(|s| {
                s.component_id == id && s.version_id == v.id
            });
            let downloaded = status
                .map(|s| s.downloaded)
                .unwrap_or_else(|| is_downloaded_for_store(store, id, v.id));
            let installed = status.map(|s| s.installed).unwrap_or(false);
            let is_active = status.map(|s| s.is_active).unwrap_or(false)
                || (installed && version_id == v.id);
            VersionOption {
                id: v.id.to_string(),
                label: v.label.to_string(),
                engine: v.engine.map(|e| match e {
                    crate::stack::types::DbEngine::Mysql => "mysql".to_string(),
                    crate::stack::types::DbEngine::MariaDb => "mariadb".to_string(),
                }),
                downloaded,
                installed,
                is_active,
                port: status.and_then(|s| (s.port != 0).then_some(s.port)),
            }
        })
        .collect();

    let downloaded = is_downloaded_for_store(store, id, &version_id);
    let download_path = zip_cache_path_for_store(store, &ver.filename)
        .ok()
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned());

    let (config_path, log_path) = if store.install_root.is_some()
        && matches!(
            id,
            | "composer" | "python" | "pip" | "go" | "java" | "node" | "npm" | "redis" | "rabbitmq"
        )
    {
        let installed = match id {
            "mysql" => store.mysql.is_some(),
            "mariadb" => store.mariadb.is_some(),
            "nginx" => store.nginx.is_some(),
            "openresty" => store.openresty.is_some(),
            "php" => store.php.is_some(),
            "composer" => store.composer.is_some(),
            "python" => store.python.is_some(),
            "pip" => store.pip.is_some(),
            "go" => store.go.is_some(),
            "java" => store.java.is_some(),
            "node" => store.node.is_some(),
            "npm" => store.npm.is_some(),
            "redis" => store.redis.is_some(),
            "rabbitmq" => store.rabbitmq.is_some(),
            _ => false,
        };
        if installed {
            component_paths(store, id)
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    match id {
        "mysql" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.mysql.as_ref().map(|m| {
                (
                    m.port,
                    m.home_dir.clone(),
                    m.pid,
                    service_status_with_snapshot(port_snapshot, m.port, m.pid),
                    Some(format!("127.0.0.1:{} · root 无密码", m.port)),
                    m.version_label.clone(),
                )
            }),
        )),
        "mariadb" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.mariadb.as_ref().map(|m| {
                (
                    m.port,
                    m.home_dir.clone(),
                    m.pid,
                    service_status_with_snapshot(port_snapshot, m.port, m.pid),
                    Some(format!("127.0.0.1:{} · root 无密码", m.port)),
                    m.version_label.clone(),
                )
            }),
        )),
        "nginx" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.nginx.as_ref().map(|n| {
                (
                    n.port,
                    n.home_dir.clone(),
                    n.pid,
                    service_status_with_snapshot(port_snapshot, n.port, n.pid),
                    Some(format!("http://127.0.0.1:{}", n.port)),
                    n.version_label.clone(),
                )
            }),
        )),
        "caddy" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.caddy.as_ref().map(|c| {
                (
                    c.port,
                    c.home_dir.clone(),
                    c.pid,
                    service_status_with_snapshot(port_snapshot, c.port, c.pid),
                    Some(format!("http://127.0.0.1:{}", c.port)),
                    c.version_label.clone(),
                )
            }),
        )),

        "openresty" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.openresty.as_ref().map(|n| {
                (
                    n.port,
                    n.home_dir.clone(),
                    n.pid,
                    service_status_with_snapshot(port_snapshot, n.port, n.pid),
                    Some(format!("http://127.0.0.1:{}", n.port)),
                    n.version_label.clone(),
                )
            }),
        )),
        "php" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.php.as_ref().map(|p| {
                (
                    p.port,
                    p.home_dir.clone(),
                    p.pid,
                    service_status_with_snapshot(port_snapshot, p.port, p.pid),
                    Some(format!("FastCGI 127.0.0.1:{}", p.port)),
                    p.version_label.clone(),
                )
            }),
        )),
        "composer" => build_cli_view(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store.composer.as_ref(),
            crate::stack::composer::composer_exe,
            store,
        ),
        "python" => build_cli_view(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store.python.as_ref(),
            crate::stack::python_runtime::launcher,
            store,
        ),
        "pip" => build_cli_view(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store.pip.as_ref(),
            crate::stack::pip::launcher,
            store,
        ),
        "go" => {
            let mut view = build_cli_view(
                id,
                comp.name,
                &version_id,
                ver.label,
                available_versions,
                comp.default_port,
                downloaded,
                download_path,
                config_path,
                log_path,
                store.go.as_ref(),
                crate::stack::go_runtime::launcher,
                store,
            )?;
            if view.installed {
                view.hint = Some("内置 go mod / go get".into());
            }
            Ok(view)
        }
        "java" => {
            let mut view = build_cli_view(
                id,
                comp.name,
                &version_id,
                ver.label,
                available_versions,
                comp.default_port,
                downloaded,
                download_path,
                config_path,
                log_path,
                store.java.as_ref(),
                crate::stack::java_runtime::launcher,
                store,
            )?;
            if view.installed {
                view.hint = Some("提供 java / javac / jar / jshell".into());
            }
            Ok(view)
        }
        "node" => build_cli_view(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store.node.as_ref(),
            crate::stack::node_runtime::launcher,
            store,
        ),
        "npm" => build_cli_view(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store.npm.as_ref(),
            crate::stack::npm::launcher,
            store,
        ),
        "redis" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.redis.as_ref().map(|r| {
                (
                    r.port,
                    r.home_dir.clone(),
                    r.pid,
                    service_status_with_snapshot(port_snapshot, r.port, r.pid),
                    Some(format!("127.0.0.1:{}", r.port)),
                    r.version_label.clone(),
                )
            }),
        )),
        "kafka" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.kafka.as_ref().map(|k| {
                let home = std::path::Path::new(&k.home_dir);
                (
                    k.port,
                    k.home_dir.clone(),
                    k.pid,
                    service_status_with_snapshot(port_snapshot, k.port, k.pid),
                    Some(format!("Kafka broker 127.0.0.1:{} · 需 JDK 17+", k.port)),
                    k.version_label.clone(),
                )
            }),
        )),
        "rocketmq" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.rocketmq.as_ref().map(|r| {
                (
                    r.port,
                    r.home_dir.clone(),
                    r.namesrv_pid,
                    service_status_with_snapshot(port_snapshot, r.port, r.namesrv_pid),
                    Some(format!(
                        "NameServer 127.0.0.1:{} · Broker 127.0.0.1:{} · 需 JDK 8+",
                        r.port,
                        if r.broker_port == 0 { 10911 } else { r.broker_port }
                    )),
                    r.version_label.clone(),
                )
            }),
        )),
        "rabbitmq" => Ok(component_from_install(
            id,
            comp.name,
            &version_id,
            ver.label,
            available_versions,
            comp.default_port,
            downloaded,
            download_path,
            config_path,
            log_path,
            store,
            store.rabbitmq.as_ref().map(|r| {
                let home = std::path::Path::new(&r.home_dir);
                let mut hint = format!(
                    "AMQP 127.0.0.1:{} · 管理 http://127.0.0.1:{}",
                    r.port, r.mgmt_port
                );
                if r.delayed_plugin {
                    hint.push_str(" · 延时插件已启用");
                } else if let Some(msg) =
                    crate::stack::rabbitmq::delayed_plugin::unsupported_message(home, &r.version_label)
                {
                    hint.push_str(" · ");
                    hint.push_str(msg);
                } else if crate::stack::rabbitmq::delayed_plugin::is_version_supported(
                    home,
                    &r.version_label,
                ) {
                    hint.push_str(" · 延时插件未安装");
                }
                (
                    r.port,
                    r.home_dir.clone(),
                    r.pid,
                    service_status_with_snapshot(port_snapshot, r.port, r.pid),
                    Some(hint),
                    r.version_label.clone(),
                )
            }),
        )),
        _ => Err(format!("未知组件: {id}")),
    }
}

fn build_cli_view(
    id: &str,
    name: &str,
    selected_version_id: &str,
    selected_version_label: &str,
    available_versions: Vec<VersionOption>,
    default_port: u16,
    downloaded: bool,
    download_path: Option<String>,
    config_path: Option<String>,
    log_path: Option<String>,
    install: Option<&CliInstall>,
    launcher: fn(&CliInstall) -> std::path::PathBuf,
    store: &StackStore,
) -> Result<ComponentView, String> {
    let mut view = component_from_install(
        id,
        name,
        selected_version_id,
        selected_version_label,
        available_versions,
        default_port,
        downloaded,
        download_path,
        config_path,
        log_path,
        store,
        install.map(|c| {
            let cmd = launcher(c).to_string_lossy().into_owned();
            (
                0,
                c.home_dir.clone(),
                None,
                ServiceStatus::Stopped,
                Some(cmd),
                c.version_label.clone(),
            )
        }),
    );
    if !view.installed {
        if let Some(dep) = cli_prerequisite(id) {
            let dep_installed = match dep {
                "php" => store.php.is_some(),
                "python" => store.python.is_some(),
                "node" => store.node.is_some(),
                _ => true,
            };
            if !dep_installed {
                let dep_name = manifest::get_component(dep).map(|c| c.name).unwrap_or(dep);
                view.hint = Some(format!("需先安装 {dep_name}"));
            }
        }
    }
    Ok(view)
}

fn component_from_install(
    id: &str,
    name: &str,
    selected_version_id: &str,
    selected_version_label: &str,
    available_versions: Vec<VersionOption>,
    default_port: u16,
    downloaded: bool,
    download_path: Option<String>,
    config_path: Option<String>,
    log_path: Option<String>,
    store: &StackStore,
    installed: Option<(u16, String, Option<u32>, ServiceStatus, Option<String>, String)>,
) -> ComponentView {
    let in_system_path = installed
        .as_ref()
        .is_some_and(|_| crate::stack::path_env::is_component_path_enabled(store, id));
    if let Some((port, home_dir, pid, status, hint, installed_version)) = installed {
        ComponentView {
            id: id.to_string(),
            name: name.to_string(),
            selected_version_id: selected_version_id.to_string(),
            selected_version_label: installed_version,
            available_versions,
            default_port,
            downloaded,
            download_path,
            installed: true,
            status,
            port: if port == 0 { None } else { Some(port) },
            home_dir: Some(home_dir),
            pid,
            hint,
            config_path,
            log_path,
            in_system_path,
        }
    } else {
        ComponentView {
            id: id.to_string(),
            name: name.to_string(),
            selected_version_id: selected_version_id.to_string(),
            selected_version_label: selected_version_label.to_string(),
            available_versions,
            default_port,
            downloaded,
            download_path,
            installed: false,
            status: ServiceStatus::NotInstalled,
            port: None,
            home_dir: None,
            pid: None,
            hint: if downloaded {
                Some("安装包已就绪，点击安装".into())
            } else {
                Some("选择版本后下载或导入本地 zip".into())
            },
            config_path: None,
            log_path: None,
            in_system_path: false,
        }
    }
}
