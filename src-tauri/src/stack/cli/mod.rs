use std::fs;
use std::path::{Path, PathBuf};

pub fn path_forward(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn tool_bat(home: &Path, name: &str) -> PathBuf {
    home.join(format!("{name}.bat"))
}

pub fn sync_bin_launcher(install_root: &Path, tool_name: &str, home_bat: &Path) -> Result<(), String> {
    let bin_dir = install_root.join("bin");
    fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    let home_bat_str = path_forward(home_bat);
    let launcher = format!(
        r#"@echo off
setlocal
call "{home_bat_str}" %*
"#
    );
    fs::write(bin_dir.join(format!("{tool_name}.bat")), &launcher)
        .map_err(|e| e.to_string())?;
    fs::write(bin_dir.join(format!("{tool_name}.cmd")), &launcher)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_bin_launcher(install_root: &Path, tool_name: &str) {
    let bin = install_root.join("bin");
    let _ = fs::remove_file(bin.join(format!("{tool_name}.bat")));
    let _ = fs::remove_file(bin.join(format!("{tool_name}.cmd")));
}

pub fn write_exe_wrapper(home: &Path, wrapper_name: &str, exe: &Path) -> Result<(), String> {
    let exe_str = path_forward(exe);
    let bat = format!(
        r#"@echo off
setlocal
"{exe_str}" %*
"#
    );
    fs::write(home.join(format!("{wrapper_name}.bat")), &bat).map_err(|e| e.to_string())?;
    fs::write(home.join(format!("{wrapper_name}.cmd")), &bat).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn write_cmd_wrapper(home: &Path, wrapper_name: &str, cmd_script: &Path) -> Result<(), String> {
    let cmd_str = path_forward(cmd_script);
    let bat = format!(
        r#"@echo off
setlocal
call "{cmd_str}" %*
"#
    );
    fs::write(home.join(format!("{wrapper_name}.bat")), &bat).map_err(|e| e.to_string())?;
    fs::write(home.join(format!("{wrapper_name}.cmd")), &bat).map_err(|e| e.to_string())?;
    Ok(())
}
