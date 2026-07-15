use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::cli::{self, sync_bin_launcher, tool_bat, write_exe_wrapper};
use crate::stack::download::resolve_source;
use crate::stack::process_util::run_command_in;
use crate::stack::store::{load_store, require_install_root, save_store};
use crate::stack::types::{CliInstall, StackStore};

pub fn install(
    source_path: Option<&str>,
    _port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<CliInstall, String> {
    let store = load_store();
    let python = store
        .python
        .as_ref()
        .ok_or("请先安装 Python，再安装 pip")?;

    let install_root = require_install_root()?;
    let get_pip = resolve_source("pip", source_path, version_id)?;
    let meta_dir = install_root.join("pip");
    fs::create_dir_all(&meta_dir).map_err(|e| e.to_string())?;

    let python_home = Path::new(&python.home_dir);
    let python_exe = python_home.join("python.exe");
    if !python_exe.exists() {
        return Err(format!("未找到 python.exe: {}", python_exe.display()));
    }

    let get_pip_str = get_pip.to_string_lossy().into_owned();
    let output = run_command_in(
        &python_exe,
        Some(python_home),
        &[&get_pip_str, "--no-warn-script-location"],
    )?;
    if !output.status.success() {
        return Err(format!(
            "pip 引导安装失败:\n{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let pip_exe = python_home.join("Scripts").join("pip.exe");
    if !pip_exe.exists() {
        return Err(format!("未找到 pip.exe: {}", pip_exe.display()));
    }

    write_exe_wrapper(&meta_dir, "pip", &pip_exe)?;
    sync_bin_launcher(&install_root, "pip", &tool_bat(&meta_dir, "pip"))?;

    let install = CliInstall {
        version_label: version_name.to_string(),
        home_dir: meta_dir.to_string_lossy().into_owned(),
    };
    let mut store = load_store();
    store.pip = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn write_wrappers(install: &CliInstall, store: &StackStore) -> Result<(), String> {
    let python = store
        .python
        .as_ref()
        .ok_or("Python 尚未安装，无法配置 pip")?;
    let pip_exe = Path::new(&python.home_dir)
        .join("Scripts")
        .join("pip.exe");
    if !pip_exe.exists() {
        return Ok(());
    }
    let meta_dir = Path::new(&install.home_dir);
    write_exe_wrapper(meta_dir, "pip", &pip_exe)
}

pub fn sync_if_installed(store: &StackStore, install_root: &Path) -> Result<(), String> {
    if let Some(pip) = &store.pip {
        write_wrappers(pip, store)?;
        sync_bin_launcher(install_root, "pip", &tool_bat(Path::new(&pip.home_dir), "pip"))?;
    }
    Ok(())
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if store.pip.take().is_some() {
        if let Some(root) = store.install_root.as_deref() {
            cli::remove_bin_launcher(Path::new(root), "pip");
            let _ = fs::remove_dir_all(Path::new(root).join("pip"));
        }
    }
    save_store(&store)
}

pub fn launcher(install: &CliInstall) -> PathBuf {
    tool_bat(Path::new(&install.home_dir), "pip")
}
