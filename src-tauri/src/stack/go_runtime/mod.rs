use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::cli::{self, path_forward, sync_bin_launcher, tool_bat};
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
    let source = resolve_source("go", source_path, version_id)?;
    let base = install_root.join("go");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["bin", "go.exe"])
        .or_else(|_| find_home_with_binary(scan_root, &["go.exe"]))?;

    let install = CliInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
    };

    write_go_wrapper(&home_dir)?;
    sync_bin_launcher(&install_root, "go", &tool_bat(&home_dir, "go"))?;

    let mut store = load_store();
    store.go = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if store.go.take().is_some() {
        if let Some(root) = store.install_root.as_deref() {
            let root = Path::new(root);
            cli::remove_bin_launcher(root, "go");
            let base = root.join("go");
            if base.exists() {
                let _ = fs::remove_dir_all(base);
            }
        }
    }
    save_store(&store)
}

pub fn launcher(install: &CliInstall) -> PathBuf {
    tool_bat(Path::new(&install.home_dir), "go")
}

fn write_go_wrapper(home: &Path) -> Result<(), String> {
    let goroot = path_forward(home);
    let go_exe = path_forward(&home.join("bin").join("go.exe"));
    let bat = format!(
        r#"@echo off
setlocal
set "GOROOT={goroot}"
set "PATH=%GOROOT%\bin;%PATH%"
"{go_exe}" %*
"#
    );
    fs::write(home.join("go.bat"), &bat).map_err(|e| e.to_string())?;
    fs::write(home.join("go.cmd"), &bat).map_err(|e| e.to_string())?;
    Ok(())
}
