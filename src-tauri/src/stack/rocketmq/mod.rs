use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::stack::download::resolve_source;
use crate::stack::extract::{extract_zip, find_home_with_binary};
use crate::stack::process_util::{
    check_port_before_start, find_pid_by_port, is_port_listening, kill_pid, run_command_in,
    service_status, spawn_windows_background_with_env, wait_for_port,
};
use crate::stack::store::{load_store, require_install_root, save_store};
use crate::stack::types::{RocketMqInstall, ServiceStatus};

const DEFAULT_BROKER_PORT: u16 = 10911;

pub fn install(
    source_path: Option<&str>,
    port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<RocketMqInstall, String> {
    let install_root = require_install_root()?;
    let source = resolve_source("rocketmq", source_path, version_id)?;
    let base = install_root.join("rocketmq");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["bin", "mqnamesrv.cmd"])?;

    let install = RocketMqInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
        port,
        broker_port: DEFAULT_BROKER_PORT,
        pid: None,
        namesrv_pid: None,
    };

    let mut store = load_store();
    store.rocketmq = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if let Some(install) = store.rocketmq.take() {
        let _ = stop(&install);
        let base = Path::new(&install.home_dir);
        if let Some(parent) = base.parent() {
            if parent.file_name().and_then(|n| n.to_str()) == Some("rocketmq") && parent.exists() {
                let _ = fs::remove_dir_all(parent);
            } else if base.exists() {
                let _ = fs::remove_dir_all(base);
            }
        }
    }
    save_store(&store)
}

pub fn start() -> Result<RocketMqInstall, String> {
    let mut store = load_store();
    let mut install = store.rocketmq.as_ref().ok_or("RocketMQ 尚未安装")?.clone();
    if install.broker_port == 0 {
        install.broker_port = DEFAULT_BROKER_PORT;
    }

    let java = resolve_java_home(&store)?;
    let env = java_env(&java, &install.home_dir);

    let existing_namesrv = check_port_before_start(install.port, install.namesrv_pid, "RocketMQ NameServer")?;
    let existing_broker = check_port_before_start(install.broker_port, install.pid, "RocketMQ Broker")?;
    if let Some(pid) = existing_namesrv {
        install.namesrv_pid = Some(pid);
    }
    if let Some(pid) = existing_broker {
        install.pid = Some(pid);
    }
    if existing_namesrv.is_some() && existing_broker.is_some() {
        if let Some(r) = store.rocketmq.as_mut() {
            r.broker_port = install.broker_port;
            r.pid = install.pid;
            r.namesrv_pid = install.namesrv_pid;
            save_store(&store)?;
        }
        return Ok(install);
    }

    let home = Path::new(&install.home_dir);
    let bin = home.join("bin");

    if existing_namesrv.is_none() {
        let namesrv = bin.join("mqnamesrv.cmd");
        if !namesrv.exists() {
            return Err(format!("未找到 mqnamesrv.cmd: {}", namesrv.display()));
        }
        spawn_windows_background_with_env(&namesrv, Some(&bin), &[], &env)?;
        if !wait_for_port(install.port, Duration::from_secs(12)) {
            return Err(format!("RocketMQ NameServer 启动失败，端口 {} 未监听", install.port));
        }
        install.namesrv_pid = find_pid_by_port(install.port);
    }

    if existing_broker.is_none() {
        let broker = bin.join("mqbroker.cmd");
        if !broker.exists() {
            return Err(format!("未找到 mqbroker.cmd: {}", broker.display()));
        }
        let namesrv_addr = format!("127.0.0.1:{}", install.port);
        let args = ["-n", namesrv_addr.as_str()];
        spawn_windows_background_with_env(&broker, Some(&bin), &args, &env)?;
        if !wait_for_port(install.broker_port, Duration::from_secs(18)) {
            return Err(format!(
                "RocketMQ Broker 启动失败，端口 {} 未监听",
                install.broker_port
            ));
        }
        install.pid = find_pid_by_port(install.broker_port);
    }

    if let Some(r) = store.rocketmq.as_mut() {
        r.broker_port = install.broker_port;
        r.pid = install.pid;
        r.namesrv_pid = install.namesrv_pid;
        save_store(&store)?;
    }
    store.rocketmq.clone().ok_or_else(|| "RocketMQ 状态丢失".into())
}

pub fn stop(install: &RocketMqInstall) -> Result<(), String> {
    let store = load_store();
    let java = resolve_java_home(&store).ok();
    let env = java.map(|j| java_env(&j, &install.home_dir));
    let home = Path::new(&install.home_dir);
    let bin = home.join("bin");
    let shutdown = bin.join("mqshutdown.cmd");
    if shutdown.exists() {
        let _ = match &env {
            Some(env) => run_cmd_in_with_env(&shutdown, Some(&bin), &["broker"], env),
            None => run_command_in(&shutdown, Some(&bin), &["broker"]).map(|_| ()),
        };
        std::thread::sleep(Duration::from_millis(600));
        let _ = match &env {
            Some(env) => run_cmd_in_with_env(&shutdown, Some(&bin), &["namesrv"], env),
            None => run_command_in(&shutdown, Some(&bin), &["namesrv"]).map(|_| ()),
        };
        std::thread::sleep(Duration::from_millis(600));
    }

    let broker_port = if install.broker_port == 0 {
        DEFAULT_BROKER_PORT
    } else {
        install.broker_port
    };

    if is_port_listening(broker_port) {
        if let Some(pid) = install.pid.or_else(|| find_pid_by_port(broker_port)) {
            let _ = kill_pid(pid);
        }
    }
    if is_port_listening(install.port) {
        if let Some(pid) = install.namesrv_pid.or_else(|| find_pid_by_port(install.port)) {
            let _ = kill_pid(pid);
        }
    }

    let mut store = load_store();
    if let Some(ref mut r) = store.rocketmq {
        r.pid = None;
        r.namesrv_pid = None;
        save_store(&store)?;
    }
    Ok(())
}

pub fn stop_from_store() -> Result<RocketMqInstall, String> {
    let install = load_store().rocketmq.ok_or("RocketMQ 尚未安装")?;
    stop(&install)?;
    load_store().rocketmq.ok_or_else(|| "RocketMQ 状态丢失".into())
}

pub fn status(install: &RocketMqInstall) -> ServiceStatus {
    let broker_port = if install.broker_port == 0 {
        DEFAULT_BROKER_PORT
    } else {
        install.broker_port
    };
    let namesrv = service_status(install.port, install.namesrv_pid);
    let broker = service_status(broker_port, install.pid);
    if matches!(namesrv, ServiceStatus::Running) || matches!(broker, ServiceStatus::Running) {
        ServiceStatus::Running
    } else {
        ServiceStatus::Stopped
    }
}

fn resolve_java_home(store: &crate::stack::types::StackStore) -> Result<PathBuf, String> {
    if let Some(j) = store.java.as_ref() {
        return Ok(PathBuf::from(&j.home_dir));
    }
    if let Ok(home) = std::env::var("JAVA_HOME") {
        if !home.trim().is_empty() {
            let p = PathBuf::from(home);
            if p.join("bin").join("java.exe").exists() {
                return Ok(p);
            }
        }
    }
    Err("未找到 JDK，请先安装 Java 组件或设置 JAVA_HOME".into())
}

fn java_env(java_home: &Path, rocketmq_home: &str) -> Vec<(&'static str, String)> {
    let mut env = Vec::new();
    env.push(("JAVA_HOME", java_home.to_string_lossy().into_owned()));
    let bin = java_home.join("bin").to_string_lossy().into_owned();
    env.push(("PATH", format!("{bin};{}", std::env::var("PATH").unwrap_or_default())));
    env.push(("ROCKETMQ_HOME", rocketmq_home.to_string()));
    env
}

fn run_cmd_in_with_env(
    script: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
    env: &[(&str, String)],
) -> Result<(), String> {
    let mut cmd = std::process::Command::new("cmd");
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    for (k, v) in env {
        cmd.env(k, v);
    }
    cmd.arg("/C");
    cmd.arg(script);
    cmd.args(args);
    let status = cmd.status().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("执行 {} 失败", script.display()))
    }
}
