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
    let source = resolve_source("python", source_path, version_id)?;
    let base = install_root.join("python");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    if source.is_file() {
        extract_zip(&source, &base)?;
    }
    let scan_root = if source.is_file() { &base } else { &source };
    let home_dir = find_home_with_binary(scan_root, &["python.exe"])?;
    configure_embedded_python(&home_dir)?;

    let install = CliInstall {
        version_label: version_name.to_string(),
        home_dir: home_dir.to_string_lossy().into_owned(),
    };

    let python_exe = home_dir.join("python.exe");
    write_exe_wrapper(&home_dir, "python", &python_exe)?;
    sync_bin_launcher(&install_root, "python", &tool_bat(&home_dir, "python"))?;

    let mut store = load_store();
    store.python = Some(install.clone());
    save_store(&store)?;
    Ok(install)
}

pub fn uninstall() -> Result<(), String> {
    let mut store = load_store();
    if let Some(install) = store.python.take() {
        let home = Path::new(&install.home_dir);
        if let Some(root) = store.install_root.as_deref() {
            cli::remove_bin_launcher(Path::new(root), "python");
        }
        if home.exists() {
            let _ = fs::remove_dir_all(home);
        }
    }
    save_store(&store)
}

pub fn python_exe(install: &CliInstall) -> PathBuf {
    Path::new(&install.home_dir).join("python.exe")
}

pub fn launcher(install: &CliInstall) -> PathBuf {
    tool_bat(Path::new(&install.home_dir), "python")
}

fn find_python_pth(home: &Path) -> Option<PathBuf> {
    fs::read_dir(home).ok()?.flatten().find_map(|entry| {
        let path = entry.path();
        if !path.is_file() {
            return None;
        }
        let name = path.file_name()?.to_string_lossy();
        // embed 包为 python312._pth；Path::extension() 会得到 "_pth" 而非 "pth"
        if name.ends_with("._pth") || name.eq_ignore_ascii_case("python._pth") {
            Some(path)
        } else {
            None
        }
    })
}

fn configure_embedded_python(home: &Path) -> Result<(), String> {
    fs::create_dir_all(home.join("Lib").join("site-packages")).map_err(|e| e.to_string())?;
    fs::create_dir_all(home.join("Scripts")).map_err(|e| e.to_string())?;

    let Some(pth) = find_python_pth(home) else {
        // 完整安装包无 ._pth，目录结构已自带 site-packages 支持
        if home.join("Lib").join("encodings").exists() {
            return Ok(());
        }
        return Err(format!(
            "未找到 python*._pth（embed 包）或 Lib/encodings（完整包）: {}",
            home.display()
        ));
    };

    let mut content = fs::read_to_string(&pth).map_err(|e| e.to_string())?;
    if !content.contains("import site") {
        content.push_str("\nimport site\n");
    } else {
        content = content.replace("#import site", "import site");
    }
    for line in ["Lib\\site-packages", "Scripts"] {
        if !content.lines().any(|l| l.trim() == line) {
            content.push('\n');
            content.push_str(line);
            content.push('\n');
        }
    }
    fs::write(&pth, content).map_err(|e| e.to_string())?;
    Ok(())
}
