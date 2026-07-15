const AUTOSTART_APP_NAME: &str = "Dev Env";

const BOOT_SERVICES_ARG: &str = "--boot-services";

fn build_autostart() -> Result<auto_launch::AutoLaunch, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    auto_launch::AutoLaunchBuilder::new()
        .set_app_name(AUTOSTART_APP_NAME)
        .set_app_path(exe_path.to_str().ok_or("Invalid exe path")?)
        .set_args(&[BOOT_SERVICES_ARG])
        .build()
        .map_err(|e| e.to_string())
}

pub fn query_app_autostart() -> Result<bool, String> {
    let autolaunch = build_autostart()?;
    autolaunch.is_enabled().map_err(|e| e.to_string())
}

pub fn update_boot_autostart(enabled: bool) -> Result<(), String> {
    let autolaunch = build_autostart()?;
    if enabled {
        autolaunch
            .enable()
            .map_err(|e| format!("启用开机自启动失败: {e}"))?;
    } else if autolaunch.is_enabled().unwrap_or(false) {
        autolaunch
            .disable()
            .map_err(|e| format!("禁用开机自启动失败: {e}"))?;
    }
    Ok(())
}

pub fn is_boot_services_launch() -> bool {
    std::env::args().any(|a| a == BOOT_SERVICES_ARG)
}
