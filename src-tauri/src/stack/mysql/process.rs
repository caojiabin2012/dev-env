use std::path::Path;

use crate::stack::mysql::config::write_config;
use crate::stack::mysql::install::{ensure_data_initialized, find_mysqld};
use crate::stack::process_util::{
    check_port_before_start_with_process, find_pid_by_port, is_port_listening, kill_pid,
    path_forward, run_command_in, service_status, spawn_service_in, tail_file, wait_for_port,
    wait_for_port_release,
};
use crate::stack::store::{db_paths, load_store, save_store};
use crate::stack::types::{DbEngine, MysqlInstall, StackStore};

fn component_for(install: &MysqlInstall) -> &'static str {
    match install.engine {
        DbEngine::Mysql => "mysql",
        DbEngine::MariaDb => "mariadb",
    }
}

fn get_install(store: &StackStore, component: &str) -> Result<MysqlInstall, String> {
    match component {
        "mysql" => store
            .mysql
            .clone()
            .ok_or_else(|| "MySQL 尚未安装".into()),
        "mariadb" => store
            .mariadb
            .clone()
            .ok_or_else(|| "MariaDB 尚未安装".into()),
        _ => Err(format!("未知数据库组件: {component}")),
    }
}

fn set_pid(store: &mut StackStore, component: &str, pid: Option<u32>) -> Result<(), String> {
    match component {
        "mysql" => {
            if let Some(mysql) = store.mysql.as_mut() {
                mysql.pid = pid;
            }
        }
        "mariadb" => {
            if let Some(mariadb) = store.mariadb.as_mut() {
                mariadb.pid = pid;
            }
        }
        _ => return Err(format!("未知数据库组件: {component}")),
    }
    Ok(())
}

fn take_install_after_stop(store: &StackStore, component: &str) -> Result<MysqlInstall, String> {
    match component {
        "mysql" => store
            .mysql
            .clone()
            .ok_or_else(|| "MySQL 状态丢失".into()),
        "mariadb" => store
            .mariadb
            .clone()
            .ok_or_else(|| "MariaDB 状态丢失".into()),
        _ => Err(format!("未知数据库组件: {component}")),
    }
}

pub fn stop(install: &MysqlInstall) -> Result<(), String> {
    if is_port_listening(install.port) {
        if let Ok(admin) = mysqladmin_path(Path::new(&install.home_dir)) {
            let port = install.port.to_string();
            let bin_dir = Path::new(&install.home_dir).join("bin");
            let _ = run_command_in(
                &admin,
                Some(&bin_dir),
                &["-h", "127.0.0.1", "-u", "root", "-P", &port, "shutdown"],
            );
            std::thread::sleep(std::time::Duration::from_millis(800));
        }
        if is_port_listening(install.port) {
            if let Some(pid) = install.pid.or_else(|| find_pid_by_port(install.port)) {
                kill_pid(pid)?;
            }
        }
    } else if let Some(pid) = install.pid {
        let _ = kill_pid(pid);
    }
    let _ = wait_for_port_release(install.port, std::time::Duration::from_secs(10));
    clear_pid(component_for(install))
}

pub fn start(component: &str) -> Result<MysqlInstall, String> {
    let mut store = load_store();
    let install = get_install(&store, component)?;
    let expected = match install.engine {
        DbEngine::MariaDb => Some("mariadbd.exe"),
        DbEngine::Mysql => Some("mysqld.exe"),
    };
    if let Some(running_pid) = check_port_before_start_with_process(
        install.port,
        install.pid,
        install.engine.label(),
        expected,
    )? {
        if install.pid.is_none() {
            set_pid(&mut store, component, Some(running_pid))?;
            save_store(&store)?;
        }
        let _ = crate::stack::mysql::sample::ensure_test_database(&install);
        return get_install(&store, component);
    }

    let root = store.install_root.as_ref().ok_or("安装目录未设置")?;
    let install_root = Path::new(root);
    write_config(install_root, &install)?;
    ensure_data_initialized(component, &install, install_root)?;

    let (my_ini_path, data_dir, logs_dir) = db_paths(install_root, component);
    std::fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    remove_stale_pid_files(&data_dir);
    let datadir_ini = data_dir.join("my.ini");
    if datadir_ini.exists() {
        let _ = std::fs::remove_file(datadir_ini);
    }
    let _ = wait_for_port_release(install.port, std::time::Duration::from_secs(5));

    let mysqld = find_mysqld(Path::new(&install.home_dir), install.engine)?;
    let home = Path::new(&install.home_dir);
    let ini = path_forward(&my_ini_path);
    let log = logs_dir.join("error.log");
    let defaults = format!("--defaults-file={ini}");

    for attempt in 0..2 {
        let pid = spawn_service_in(
            &mysqld,
            Some(&home.join("bin")),
            &[&defaults],
        )?;

        if wait_for_port(install.port, std::time::Duration::from_secs(20)) {
            let running_pid = find_pid_by_port(install.port).unwrap_or(pid);
            set_pid(&mut store, component, Some(running_pid))?;
            save_store(&store)?;
            let install = take_install_after_stop(&store, component)?;
            let _ = crate::stack::mysql::sample::ensure_test_database(&install);
            return Ok(install);
        }

        let _ = kill_pid(pid);
        if let Some(running_pid) = find_pid_by_port(install.port) {
            set_pid(&mut store, component, Some(running_pid))?;
            save_store(&store)?;
            let install = take_install_after_stop(&store, component)?;
            let _ = crate::stack::mysql::sample::ensure_test_database(&install);
            return Ok(install);
        }

        if attempt == 0 {
            if let Some(pid) = find_pid_by_port(install.port) {
                let _ = kill_pid(pid);
            }
            let _ = wait_for_port_release(install.port, std::time::Duration::from_secs(3));
            remove_stale_pid_files(&data_dir);
            continue;
        }

        let hint = tail_file(&log, 4096).unwrap_or_default();
        return Err(format!(
            "{} 启动失败，端口 {} 未就绪。请查看 {}\n{hint}",
            install.engine.label(),
            install.port,
            log.display()
        ));
    }

    unreachable!()
}

pub fn stop_from_store(component: &str) -> Result<MysqlInstall, String> {
    let install = get_install(&load_store(), component)?;
    stop(&install)?;
    take_install_after_stop(&load_store(), component)
}

pub fn status(install: &MysqlInstall) -> crate::stack::types::ServiceStatus {
    service_status(install.port, install.pid)
}

fn mysqladmin_path(home: &Path) -> Result<std::path::PathBuf, String> {
    for name in ["mysqladmin.exe", "mariadb-admin.exe"] {
        let path = home.join("bin").join(name);
        if path.exists() {
            return Ok(path);
        }
    }
    Err("mysqladmin.exe 不存在".into())
}

fn remove_stale_pid_files(data_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(data_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("pid") {
            let _ = std::fs::remove_file(path);
        }
    }
}

fn clear_pid(component: &str) -> Result<(), String> {
    let mut store = load_store();
    set_pid(&mut store, component, None)?;
    save_store(&store)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn port_probe_when_mariadb_running() {
        if !Path::new(r"D:\jiabin\mysql\mariadb-11.4.2-winx64\bin\mariadbd.exe").exists() {
            return;
        }
        let _ = find_pid_by_port(3308);
    }

    #[test]
    fn mariadb_start_integration() {
        let home = Path::new(r"D:\jiabin\mysql\mariadb-11.4.2-winx64\bin\mariadbd.exe");
        if !home.exists() {
            return;
        }
        let _ = home;
    }
}
