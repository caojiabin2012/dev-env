use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::cli::{self, sync_bin_launcher, tool_bat, write_exe_wrapper};
use crate::stack::download::resolve_source;
use crate::stack::extract::{extract_zip, find_home_with_binary};
use crate::stack::store::{load_store, require_install_root, save_store};
use crate::stack::types::CliInstall;

pub fn install(
    source_path: Option<&str>,
    _port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<CliInstall, String> {
    let install_root = require_install_root()?;
    let source = resolve_source("node", source_path, version_id)?;
    let base = install_root.join("node");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["node.exe"])?;

    let install = CliInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
    };

    let node_exe = home_dir.join("node.exe");
    write_exe_wrapper(&home_dir, "node", &node_exe)?;
    sync_bin_launcher(&install_root, "node", &tool_bat(&home_dir, "node"))?;

    let mut store = load_store();
    store.node = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if let Some(install) = store.node.take() {
        if let Some(root) = store.install_root.as_deref() {
            cli::remove_bin_launcher(Path::new(root), "node");
        }
        let base = Path::new(&install.home_dir);
        if let Some(parent) = base.parent() {
            if parent.file_name().and_then(|n| n.to_str()) == Some("node") && parent.exists() {
                let _ = fs::remove_dir_all(parent);
            } else if base.exists() {
                let _ = fs::remove_dir_all(base);
            }
        }
    }
    save_store(&store)
}

pub fn node_exe(install: &CliInstall) -> PathBuf {
    Path::new(&install.home_dir).join("node.exe")
}

pub fn npm_cmd(install: &CliInstall) -> PathBuf {
    Path::new(&install.home_dir).join("npm.cmd")
}

pub fn launcher(install: &CliInstall) -> PathBuf {
    tool_bat(Path::new(&install.home_dir), "node")
}
