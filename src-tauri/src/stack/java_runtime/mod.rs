use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::cli::{self, path_forward, sync_bin_launcher, tool_bat};
use crate::stack::download::resolve_source;
use crate::stack::extract::{extract_zip, find_home_with_binary};
use crate::stack::store::{load_store, require_install_root, save_store};
use crate::stack::types::CliInstall;

const JAVA_TOOLS: &[&str] = &["java", "javac", "jar", "jarsigner", "jlink", "jpackage", "jshell", "keytool"];

pub fn install(
    source_path: Option<&str>,
    _port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<CliInstall, String> {
    let install_root = require_install_root()?;
    let source = resolve_source("java", source_path, version_id)?;
    let base = install_root.join("java");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["bin", "java.exe"])
        .or_else(|_| find_home_with_binary(scan_root, &["java.exe"]))?;

    write_java_wrappers(&home_dir)?;
    sync_java_launchers(&install_root, &home_dir)?;

    let install = CliInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
    };

    let mut store = load_store();
    store.java = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if let Some(install) = store.java.take() {
        if let Some(root) = store.install_root.as_deref() {
            let root = Path::new(root);
            for tool in JAVA_TOOLS {
                cli::remove_bin_launcher(root, tool);
            }
        }
        let base = Path::new(&install.home_dir);
        if let Some(parent) = base.parent() {
            if parent.file_name().and_then(|n| n.to_str()) == Some("java") && parent.exists() {
                let _ = fs::remove_dir_all(parent);
            } else if base.exists() {
                let _ = fs::remove_dir_all(base);
            }
        }
    }
    save_store(&store)
}

pub fn launcher(install: &CliInstall) -> PathBuf {
    tool_bat(Path::new(&install.home_dir), "java")
}

fn sync_java_launchers(install_root: &Path, home_dir: &Path) -> Result<(), String> {
    for tool in JAVA_TOOLS {
        let wrapper = tool_bat(home_dir, tool);
        if wrapper.exists() {
            sync_bin_launcher(install_root, tool, &wrapper)?;
        }
    }
    Ok(())
}

fn write_java_wrappers(home: &Path) -> Result<(), String> {
    for tool in JAVA_TOOLS {
        write_java_tool_wrapper(home, tool)?;
    }
    Ok(())
}

fn write_java_tool_wrapper(home: &Path, tool: &str) -> Result<(), String> {
    let exe = home.join("bin").join(format!("{tool}.exe"));
    if !exe.exists() {
        return Ok(());
    }
    let java_home = path_forward(home);
    let exe_str = path_forward(&exe);
    let bat = format!(
        r#"@echo off
setlocal
set "JAVA_HOME={java_home}"
set "PATH=%JAVA_HOME%\bin;%PATH%"
"{exe_str}" %*
"#
    );
    fs::write(home.join(format!("{tool}.bat")), &bat).map_err(|e| e.to_string())?;
    fs::write(home.join(format!("{tool}.cmd")), &bat).map_err(|e| e.to_string())?;
    Ok(())
}
