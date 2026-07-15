use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::download::resolve_source;
use crate::stack::store::{load_store, require_install_root, save_store};
use crate::stack::types::{CliInstall, StackStore};

const PHAR_NAME: &str = "composer.phar";
const BAT_NAME: &str = "composer.bat";
const CMD_NAME: &str = "composer.cmd";

pub fn install(
    source_path: Option<&str>,
    _port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<CliInstall, String> {
    let store = load_store();
    if store.php.is_none() {
        return Err("请先安装 PHP，再安装 Composer".into());
    }

    let install_root = require_install_root()?;
    let source = resolve_source("composer", source_path, version_id)?;
    let home_dir = install_root.join("composer");
    fs::create_dir_all(&home_dir).map_err(|e| e.to_string())?;

    let phar_path = home_dir.join(PHAR_NAME);
    if source.is_file() {
        fs::copy(&source, &phar_path).map_err(|e| e.to_string())?;
    } else {
        return Err("Composer 安装包无效".into());
    }

    let install = CliInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
    };

    write_wrappers(&install, &store)?;
    sync_path_scripts(&install_root, &install)?;

    let mut store = load_store();
    store.composer = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn write_wrappers(install: &CliInstall, store: &StackStore) -> Result<(), String> {
    let php = store
        .php
        .as_ref()
        .ok_or("PHP 尚未安装，无法配置 Composer")?;
    let php_exe = Path::new(&php.home_dir).join("php.exe");
    if !php_exe.exists() {
        return Err(format!("未找到 php.exe: {}", php_exe.display()));
    }

    let home = Path::new(&install.home_dir);
    let phar = home.join(PHAR_NAME);
    let php_str = path_forward(&php_exe);
    let phar_str = path_forward(&phar);

    let bat = format!(
        r#"@echo off
setlocal
"{php_str}" "{phar_str}" %*
"#
    );
    fs::write(home.join(BAT_NAME), &bat).map_err(|e| e.to_string())?;
    fs::write(home.join(CMD_NAME), &bat).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn sync_path_scripts(install_root: &Path, install: &CliInstall) -> Result<(), String> {
    let bin_dir = install_root.join("bin");
    fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

    let home = path_forward(Path::new(&install.home_dir));
    let launcher = format!(
        r#"@echo off
setlocal
call "{home}/{BAT_NAME}" %*
"#
    );
    fs::write(bin_dir.join(BAT_NAME), &launcher).map_err(|e| e.to_string())?;
    fs::write(bin_dir.join(CMD_NAME), &launcher).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn sync_if_installed(store: &StackStore, install_root: &Path) -> Result<(), String> {
    if let Some(composer) = &store.composer {
        write_wrappers(composer, store)?;
        sync_path_scripts(install_root, composer)?;
    }
    Ok(())
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if let Some(install) = store.composer.take() {
        let home = Path::new(&install.home_dir);
        if home.exists() {
            let _ = fs::remove_dir_all(home);
        }
        if let Some(root) = store.install_root.as_deref() {
            let bin = Path::new(root).join("bin");
            let _ = fs::remove_file(bin.join(BAT_NAME));
            let _ = fs::remove_file(bin.join(CMD_NAME));
        }
    }
    save_store(&store)
}

pub fn composer_exe(install: &CliInstall) -> PathBuf {
    Path::new(&install.home_dir).join(BAT_NAME)
}

pub fn phar_path(install: &CliInstall) -> PathBuf {
    Path::new(&install.home_dir).join(PHAR_NAME)
}

fn path_forward(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
