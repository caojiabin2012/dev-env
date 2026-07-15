use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::cli::{self, sync_bin_launcher, tool_bat, write_cmd_wrapper};
use crate::stack::node_runtime;
use crate::stack::process_util::run_command_in;
use crate::stack::store::{load_store, require_install_root, save_store};
use crate::stack::types::{CliInstall, StackStore};

pub fn install(
    _source_path: Option<&str>,
    _port: u16,
    version_name: &str,
    _version_id: Option<&str>,
) -> Result<CliInstall, String> {
    let store = load_store();
    let node = store
        .node
        .as_ref()
        .ok_or("请先安装 Node.js，再安装 npm")?;

    let install_root = require_install_root()?;
    let node_home = Path::new(&node.home_dir);
    let npm_cmd = node_runtime::npm_cmd(node);
    if !npm_cmd.exists() {
        return Err(format!("未找到 npm.cmd: {}", npm_cmd.display()));
    }

    let meta_dir = install_root.join("npm");
    fs::create_dir_all(&meta_dir).map_err(|e| e.to_string())?;
    write_cmd_wrapper(&meta_dir, "npm", &npm_cmd)?;
    sync_bin_launcher(&install_root, "npm", &tool_bat(&meta_dir, "npm"))?;

    let version_label = detect_npm_version(node).unwrap_or_else(|| version_name.to_string());
    let install = CliInstall {
        version_label,
        home_dir: meta_dir.to_string_lossy().into_owned(),
    };
    let mut store = load_store();
    store.npm = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn write_wrappers(install: &CliInstall, store: &StackStore) -> Result<(), String> {
    let node = store
        .node
        .as_ref()
        .ok_or("Node.js 尚未安装，无法配置 npm")?;
    let npm_cmd = node_runtime::npm_cmd(node);
    if !npm_cmd.exists() {
        return Ok(());
    }
    write_cmd_wrapper(Path::new(&install.home_dir), "npm", &npm_cmd)
}

pub fn sync_if_installed(store: &StackStore, install_root: &Path) -> Result<(), String> {
    if let Some(npm) = &store.npm {
        write_wrappers(npm, store)?;
        sync_bin_launcher(install_root, "npm", &tool_bat(Path::new(&npm.home_dir), "npm"))?;
    }
    Ok(())
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if store.npm.take().is_some() {
        if let Some(root) = store.install_root.as_deref() {
            cli::remove_bin_launcher(Path::new(root), "npm");
            let _ = fs::remove_dir_all(Path::new(root).join("npm"));
        }
    }
    save_store(&store)
}

pub fn launcher(install: &CliInstall) -> PathBuf {
    tool_bat(Path::new(&install.home_dir), "npm")
}

fn detect_npm_version(node: &CliInstall) -> Option<String> {
    let node_home = Path::new(&node.home_dir);
    let npm_cmd = node_runtime::npm_cmd(node);
    let output = run_command_in(&npm_cmd, Some(node_home), &["--version"]).ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        None
    } else {
        Some(format!("npm {version}"))
    }
}
