use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::stack::download::resolve_source;
use crate::stack::extract::{extract_zip, find_home_with_binary};
use crate::stack::process_util::{
    check_port_before_start_with_process, find_pid_by_port, is_port_listening, kill_pid,
    run_command_in, service_status, spawn_service_in, tail_file, wait_for_port,
};
use crate::stack::sites::{resolve_site_path, sites_for_web_server};
use crate::stack::store::{
    load_store, nginx_runtime_conf_path, require_install_root, resolve_site_root, save_store,
};
use crate::stack::types::{NginxInstall, StackStore};

const RUNTIME_CONF_NAME: &str = "devtools-nginx.conf";

#[derive(Debug, Clone, Copy)]
pub enum NginxFamilyKind {
    Nginx,
    OpenResty,
}

impl NginxFamilyKind {
    pub fn component_id(self) -> &'static str {
        match self {
            Self::Nginx => "nginx",
            Self::OpenResty => "openresty",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            Self::Nginx => "Nginx",
            Self::OpenResty => "OpenResty",
        }
    }

    fn install_subdir(self) -> &'static str {
        match self {
            Self::Nginx => "nginx",
            Self::OpenResty => "openresty",
        }
    }

    fn get_install<'a>(self, store: &'a StackStore) -> Option<&'a NginxInstall> {
        match self {
            Self::Nginx => store.nginx.as_ref(),
            Self::OpenResty => store.openresty.as_ref(),
        }
    }

    fn get_install_mut<'a>(self, store: &'a mut StackStore) -> Option<&'a mut NginxInstall> {
        match self {
            Self::Nginx => store.nginx.as_mut(),
            Self::OpenResty => store.openresty.as_mut(),
        }
    }

    fn set_install(self, store: &mut StackStore, install: NginxInstall) {
        match self {
            Self::Nginx => store.nginx = Some(install),
            Self::OpenResty => store.openresty = Some(install),
        }
    }

    fn take_install(self, store: &mut StackStore) -> Option<NginxInstall> {
        match self {
            Self::Nginx => store.nginx.take(),
            Self::OpenResty => store.openresty.take(),
        }
    }
}

pub fn install(
    kind: NginxFamilyKind,
    source_path: Option<&str>,
    port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<NginxInstall, String> {
    let component = kind.component_id();
    let mut store = load_store();
    let install_root = require_install_root()?;
    let source = resolve_source(component, source_path, version_id)?;
    let base = install_root.join(kind.install_subdir());
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["nginx.exe"])?;
    ensure_dirs(&home_dir)?;

    let store_for_www = load_store();
    crate::stack::www::sync_site_files(&store_for_www, &install_root)?;

    let install = NginxInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
        port,
        pid: None,
    };
    kind.set_install(&mut store, install.clone());
    save_store(&store)?;

    let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
    write_config(kind, &install, php_port, &store, &install_root)?;
    Ok(install)
}

pub fn write_config(
    kind: NginxFamilyKind,
    install: &NginxInstall,
    php_port: u16,
    store: &StackStore,
    install_root: &Path,
) -> Result<(), String> {
    let home = Path::new(&install.home_dir);
    let conf_path = nginx_runtime_conf_path(home);
    let conf = render_nginx_conf(
        home,
        kind.component_id(),
        install.port,
        php_port,
        install_root,
        store,
    );
    fs::write(&conf_path, conf).map_err(|e| e.to_string())?;
    if matches!(kind, NginxFamilyKind::Nginx) {
        remove_legacy_conf_if_present();
    }
    Ok(())
}

pub fn reload_if_running(install: &NginxInstall) -> Result<(), String> {
    if !is_port_listening(install.port) {
        return Ok(());
    }
    let home = Path::new(&install.home_dir);
    let nginx = home.join("nginx.exe");
    if !nginx.exists() {
        return Ok(());
    }
    let home_str = install.home_dir.clone();
    let test = run_command_in(
        &nginx,
        Some(home),
        &["-p", &home_str, "-c", RUNTIME_CONF_NAME, "-t"],
    )?;
    if !test.status.success() {
        return Err(format!(
            "配置检查失败:\n{}\n{}",
            String::from_utf8_lossy(&test.stdout),
            String::from_utf8_lossy(&test.stderr)
        ));
    }
    let _ = run_command_in(
        &nginx,
        Some(home),
        &["-p", &home_str, "-c", RUNTIME_CONF_NAME, "-s", "reload"],
    );
    Ok(())
}

pub fn uninstall(kind: NginxFamilyKind) -> Result<(), String> {
    let mut store = load_store();
    if let Some(install) = kind.take_install(&mut store) {
        let _ = stop(kind, &install);
    }
    save_store(&store)
}

pub fn start(kind: NginxFamilyKind) -> Result<NginxInstall, String> {
    let name = kind.display_name();
    let mut store = load_store();
    let install = kind
        .get_install(&store)
        .ok_or_else(|| format!("{name} 尚未安装"))?
        .clone();
    if let Some(running_pid) = check_port_before_start_with_process(
        install.port,
        install.pid,
        name,
        Some("nginx.exe"),
    )? {
        if let Some(n) = kind.get_install_mut(&mut store) {
            if n.pid.is_none() {
                n.pid = Some(running_pid);
                save_store(&store)?;
            }
        }
        return Ok(install);
    }
    let root = store.install_root.as_ref().ok_or("安装目录未设置")?;
    let install_root = Path::new(root);
    let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
    write_config(kind, &install, php_port, &store, install_root)?;

    let home = Path::new(&install.home_dir);
    ensure_dirs(home)?;
    let nginx = home.join("nginx.exe");
    if !nginx.exists() {
        return Err(format!("未找到 nginx.exe: {}", nginx.display()));
    }

    let home_str = install.home_dir.clone();
    let test = run_command_in(
        &nginx,
        Some(home),
        &["-p", &home_str, "-c", RUNTIME_CONF_NAME, "-t"],
    )?;
    if !test.status.success() {
        return Err(format!(
            "{name} 配置检查失败:\n{}\n{}",
            String::from_utf8_lossy(&test.stdout),
            String::from_utf8_lossy(&test.stderr)
        ));
    }

    spawn_service_in(
        &nginx,
        Some(home),
        &["-p", &home_str, "-c", RUNTIME_CONF_NAME],
    )?;

    if !wait_for_port(install.port, Duration::from_secs(8)) {
        let log = log_path(&install);
        let hint = tail_file(&log, 4096).unwrap_or_default();
        return Err(format!(
            "{name} 启动失败，端口 {} 未监听。请查看 {}\n{hint}",
            install.port,
            log.display()
        ));
    }

    let pid = find_pid_by_port(install.port);
    if let Some(n) = kind.get_install_mut(&mut store) {
        n.pid = pid;
        save_store(&store)?;
    }
    kind
        .get_install(&store)
        .cloned()
        .ok_or_else(|| format!("{name} 状态丢失"))
}

pub fn stop(kind: NginxFamilyKind, install: &NginxInstall) -> Result<(), String> {
    let home = Path::new(&install.home_dir);
    let nginx = home.join("nginx.exe");
    if nginx.exists() {
        let home_str = install.home_dir.clone();
        let _ = run_command_in(
            &nginx,
            Some(home),
            &["-p", &home_str, "-c", RUNTIME_CONF_NAME, "-s", "quit"],
        );
        std::thread::sleep(Duration::from_millis(500));
    }
    if is_port_listening(install.port) {
        if let Some(pid) = install.pid.or_else(|| find_pid_by_port(install.port)) {
            kill_pid(pid)?;
        }
    } else if let Some(pid) = install.pid {
        let _ = kill_pid(pid);
    }
    let mut store = load_store();
    if let Some(n) = kind.get_install_mut(&mut store) {
        n.pid = None;
        save_store(&store)?;
    }
    Ok(())
}

pub fn stop_from_store(kind: NginxFamilyKind) -> Result<NginxInstall, String> {
    let name = kind.display_name();
    let install = kind
        .get_install(&load_store())
        .ok_or_else(|| format!("{name} 尚未安装"))?
        .clone();
    stop(kind, &install)?;
    kind.get_install(&load_store())
        .cloned()
        .ok_or_else(|| format!("{name} 状态丢失"))
}

pub fn status(install: &NginxInstall) -> crate::stack::types::ServiceStatus {
    service_status(install.port, install.pid)
}

pub fn log_path(install: &NginxInstall) -> PathBuf {
    Path::new(&install.home_dir).join("logs").join("error.log")
}

pub fn runtime_conf_path(install: &NginxInstall) -> PathBuf {
    nginx_runtime_conf_path(Path::new(&install.home_dir))
}

fn ensure_dirs(home: &Path) -> Result<(), String> {
    fs::create_dir_all(home.join("logs")).map_err(|e| e.to_string())?;
    fs::create_dir_all(home.join("temp")).map_err(|e| e.to_string())?;
    Ok(())
}

fn render_nginx_conf(
    home: &Path,
    web_server_id: &str,
    port: u16,
    php_port: u16,
    install_root: &Path,
    store: &StackStore,
) -> String {
    let mime_types = path_forward(&home.join("conf").join("mime.types"));
    let fastcgi_params = path_forward(&home.join("conf").join("fastcgi_params"));

    let bound_sites = sites_for_web_server(store, web_server_id);
    let default_site = bound_sites
        .iter()
        .find(|s| s.is_default)
        .copied()
        .or_else(|| bound_sites.first().copied());

    let default_root = default_site
        .map(|s| path_forward(&resolve_site_path(install_root, s)))
        .unwrap_or_else(|| {
            path_forward(&resolve_site_root(
                install_root,
                &store.settings.www_subdir,
            ))
        });

    let mut server_blocks = String::new();
    let default_runtime = default_site.map(|s| s.runtime.as_str()).unwrap_or("php");
    let default_site_port = default_site.and_then(|s| s.port);
    server_blocks.push_str(&render_server_block_with_sites(
        port,
        true,
        "localhost 127.0.0.1",
        &default_root,
        default_runtime,
        php_port,
        &fastcgi_params,
        default_site_port,
    ));

    for site in bound_sites {
        if is_localhost_hostname(&site.hostname) {
            continue;
        }
        let www = path_forward(&resolve_site_path(install_root, site));
        let site_port = site.port;
        server_blocks.push_str(&render_server_block_with_sites(
            port,
            false,
            &site.hostname,
            &www,
            &site.runtime,
            php_port,
            &fastcgi_params,
            site_port,
        ));
    }

    format!(
        r#"# Generated by dev-tools — Nginx + PHP FastCGI (multi-site)
worker_processes  1;
error_log logs/error.log;
pid logs/nginx.pid;

events {{
    worker_connections  1024;
}}

http {{
    include       {mime_types};
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;
    client_max_body_size 128m;

{server_blocks}}}
"#
    )
}

fn render_server_block(
    port: u16,
    default_server: bool,
    server_name: &str,
    www: &str,
    runtime: &str,
    php_port: u16,
    fastcgi_params: &str,
) -> String {
    render_server_block_with_sites(port, default_server, server_name, www, runtime, php_port, fastcgi_params, None)
}

fn render_server_block_with_sites(
    port: u16,
    default_server: bool,
    server_name: &str,
    www: &str,
    runtime: &str,
    php_port: u16,
    fastcgi_params: &str,
    site_port: Option<u16>,
) -> String {
    let listen = if default_server {
        format!("        listen       {port} default_server;\n")
    } else {
        format!("        listen       {port};\n")
    };

    let (index, location_extra) = match runtime {
        "php" => (
            "index.php index.html index.htm",
            format!(
                r#"
        location / {{
            try_files $uri $uri/ /index.php?$query_string;
        }}

        location ~ \.php$ {{
            fastcgi_pass   127.0.0.1:{php_port};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        {fastcgi_params};
        }}
"#
            ),
        ),
        "go" | "python" | "node" => {
            if let Some(runtime_port) = site_port {
                (
                    "index.html index.htm",
                    format!(
                        r#"
        location / {{
            proxy_pass       http://127.0.0.1:{runtime_port};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }}
"#
                    ),
                )
            } else {
                (
                    "index.html index.htm",
                    r#"
        location / {
            try_files $uri $uri/ /index.html;
        }
"#
                    .to_string(),
                )
            }
        },
        _ => (
            "index.html index.htm index.php",
            r#"
        location / {
            try_files $uri $uri/ /index.html;
        }
"#
            .to_string(),
        ),
    };

    format!(
        r#"    server {{
{listen}        server_name  {server_name};
        root         {www};
        index        {index};
{location_extra}
        location ~ /\.ht {{
            deny all;
        }}
    }}

"#
    )
}

fn is_localhost_hostname(hostname: &str) -> bool {
    matches!(
        hostname.trim().to_ascii_lowercase().as_str(),
        "localhost" | "127.0.0.1" | "::1"
    )
}

fn remove_legacy_conf_if_present() {
    let store = load_store();
    if let Some(root) = store.install_root {
        let legacy = Path::new(&root).join("nginx").join(RUNTIME_CONF_NAME);
        let _ = fs::remove_file(legacy);
    }
}

fn path_forward(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
