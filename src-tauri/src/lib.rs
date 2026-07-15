mod app_paths;
mod diagnostics;
mod stack;
mod system;

use std::time::Duration;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    diagnostics::install_panic_hook();

    let log_dir = crate::app_paths::logs_dir();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .max_file_size(512_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Folder {
                        path: log_dir,
                        file_name: Some("app".into()),
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let icon = tauri::include_image!("icons/icon.png");
            if let Some(window) = app.get_webview_window("main") {
                if let Err(err) = window.set_icon(icon) {
                    log::warn!("设置窗口图标失败: {err}");
                }
            }

            // 仅系统开机自启（带 --boot-services 参数）时后台拉起服务，手动打开应用不会自动启动
            if stack::autostart::is_boot_services_launch() {
                std::thread::spawn(|| {
                    std::thread::sleep(Duration::from_secs(2));
                    if let Err(err) = stack::service::start_boot_autostart() {
                        log::warn!("开机自启服务失败: {err}");
                    } else {
                        log::info!("开机自启：已后台启动本地环境服务");
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            diagnostics::record_client_error,
            stack::stack_get_state,
            stack::stack_set_install_root,
            stack::stack_pick_install_root,
            stack::stack_pick_component_source,
            stack::stack_set_component_version,
            stack::stack_switch_component_version,
            stack::stack_download_component,
            stack::stack_install_component,
            stack::stack_start_component,
            stack::stack_stop_component,
            stack::stack_uninstall_component,
            stack::stack_start_all,
            stack::stack_stop_all,
            stack::stack_open_install_root,
            stack::stack_open_www_root,
            stack::stack_pick_www_subdir,
            stack::stack_update_settings,
            stack::stack_set_component_port,
            stack::stack_set_component_boot_autostart,
            stack::stack_set_component_path_env,
            stack::stack_regenerate_configs,
            stack::stack_open_component_config,
            stack::stack_open_component_log,
            stack::stack_open_site,
            stack::stack_add_site,
            stack::stack_update_site,
            stack::stack_delete_site,
            stack::stack_set_default_site,
            stack::stack_open_site_by_id,
            stack::stack_open_site_root,
            stack::stack_pick_site_root,
            stack::stack_start_site,
            stack::stack_stop_site,
            stack::db_create_database,
            stack::db_set_root_password,
            stack::db_list_databases,
            stack::db_list_tables,
            stack::db_pick_sql_file,
            stack::db_pick_export_dir,
            stack::db_import,
            stack::db_export,
            stack::redis_set_password,
            stack::redis_get_password,
            system::system_get_metrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
