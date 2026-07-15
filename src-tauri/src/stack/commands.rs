use tauri::AppHandle;

use crate::stack::config::sync_all_configs;
use crate::stack::download::download_component;
use crate::stack::service::{
    install, open_component_config, open_component_log, open_site, set_component_boot_autostart,
    set_component_path_env, set_component_port, start, start_all, stop, stop_all, switch_version, uninstall, update_settings,
};
use crate::stack::sites::{add_site, delete_site, open_site as open_site_by_id, open_site_root, pick_site_root, set_default_site};
use crate::stack::state::build_stack_state;
use crate::stack::store::{load_store, save_store, set_version_pref};
use crate::stack::mysql::manager::{self, DbInfo};
use crate::stack::types::{
    AddSiteParams, DbEngine, InstallComponentParams, SetComponentBootAutostartParams, SetComponentPathEnvParams,
    SetComponentPortParams, SetComponentVersionParams, SetPathEnvResult, StackState, SwitchComponentVersionParams, UpdateSiteParams, UpdateStackSettingsParams,
};

#[tauri::command]
pub fn stack_get_state() -> StackState {
    build_stack_state()
}

#[tauri::command]
pub fn stack_set_install_root(path: String) -> Result<StackState, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("安装目录不能为空".into());
    }
    let mut store = load_store();
    store.install_root = Some(trimmed.to_string());
    save_store(&store)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_pick_install_root() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择环境安装目录")
        .pick_folder();
    Ok(picked.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn stack_pick_www_subdir() -> Result<Option<String>, String> {
    let store = load_store();
    let root = store.install_root.as_ref().ok_or("尚未设置安装目录")?;
    let picked = rfd::FileDialog::new()
        .set_title("选择网站根目录")
        .set_directory(root)
        .pick_folder();
    Ok(picked.map(|p| {
        let picked_str = p.to_string_lossy();
        let root_path = std::path::Path::new(root);
        if let Ok(rel) = p.strip_prefix(root_path) {
            rel.to_string_lossy().replace('\\', "/")
        } else {
            picked_str.into_owned()
        }
    }))
}

#[tauri::command]
pub fn stack_pick_component_source() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择组件 zip 或已解压目录")
        .add_filter("ZIP", &["zip"])
        .add_filter("PHAR", &["phar"])
        .add_filter("Python", &["py"])
        .pick_file()
        .or_else(|| {
            rfd::FileDialog::new()
                .set_title("选择已解压目录")
                .pick_folder()
        });
    Ok(picked.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn stack_set_component_version(params: SetComponentVersionParams) -> Result<StackState, String> {
    set_version_pref(&params.component, &params.version_id)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_switch_component_version(
    params: SwitchComponentVersionParams,
) -> Result<StackState, String> {
    tauri::async_runtime::spawn_blocking(move || {
        switch_version(&params.component, &params.version_id, params.restart)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_download_component(
    app: AppHandle,
    component: String,
    version_id: Option<String>,
) -> Result<StackState, String> {
    let app_clone = app.clone();
    let version = version_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        download_component(&app_clone, &component, version.as_deref())
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_install_component(params: InstallComponentParams) -> Result<StackState, String> {
    install(&params)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_start_component(component: String) -> Result<StackState, String> {
    tauri::async_runtime::spawn_blocking(move || start(&component))
        .await
        .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_stop_component(component: String) -> Result<StackState, String> {
    tauri::async_runtime::spawn_blocking(move || stop(&component))
        .await
        .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_uninstall_component(component: String) -> Result<StackState, String> {
    uninstall(&component)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_start_all() -> Result<StackState, String> {
    tauri::async_runtime::spawn_blocking(start_all)
        .await
        .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_stop_all() -> Result<StackState, String> {
    tauri::async_runtime::spawn_blocking(stop_all)
        .await
        .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_update_settings(params: UpdateStackSettingsParams) -> Result<StackState, String> {
    update_settings(&params)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_set_component_port(params: SetComponentPortParams) -> Result<StackState, String> {
    set_component_port(&params.component, params.port)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_set_component_boot_autostart(
    params: SetComponentBootAutostartParams,
) -> Result<StackState, String> {
    set_component_boot_autostart(&params.component, params.enabled)?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_set_component_path_env(
    params: SetComponentPathEnvParams,
) -> Result<SetPathEnvResult, String> {
    let result = set_component_path_env(&params.component, params.enabled)?;
    Ok(SetPathEnvResult {
        state: build_stack_state(),
        removed: result.removed,
        system_blocked: result.system_blocked,
    })
}

#[tauri::command]
pub fn stack_regenerate_configs() -> Result<StackState, String> {
    sync_all_configs()?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_open_component_config(component: String) -> Result<(), String> {
    open_component_config(&component)
}

#[tauri::command]
pub fn stack_open_component_log(component: String) -> Result<(), String> {
    open_component_log(&component)
}

#[tauri::command]
pub fn stack_open_site() -> Result<(), String> {
    open_site()
}

#[tauri::command]
pub fn stack_add_site(params: AddSiteParams) -> Result<StackState, String> {
    add_site(&params)?;
    sync_all_configs()?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_update_site(params: UpdateSiteParams) -> Result<StackState, String> {
    crate::stack::sites::update_site(&params)?;
    sync_all_configs()?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_delete_site(site_id: String) -> Result<StackState, String> {
    delete_site(&site_id)?;
    sync_all_configs()?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_set_default_site(site_id: String) -> Result<StackState, String> {
    set_default_site(&site_id)?;
    sync_all_configs()?;
    Ok(build_stack_state())
}

#[tauri::command]
pub fn stack_open_site_by_id(site_id: String) -> Result<(), String> {
    open_site_by_id(Some(&site_id))
}

#[tauri::command]
pub fn stack_open_site_root(site_id: String) -> Result<(), String> {
    open_site_root(&site_id)
}

#[tauri::command]
pub fn stack_pick_site_root() -> Result<Option<String>, String> {
    pick_site_root()
}

#[tauri::command]
pub fn stack_open_install_root() -> Result<(), String> {
    let store = load_store();
    let root = store.install_root.ok_or("尚未设置安装目录")?;
    open::that(root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stack_open_www_root() -> Result<(), String> {
    use std::path::Path;
    let store = load_store();
    let root = store.install_root.as_ref().ok_or("尚未设置安装目录")?;
    let www = crate::stack::store::www_root(Path::new(root));
    std::fs::create_dir_all(&www).map_err(|e| e.to_string())?;
    open::that(www).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stack_start_site(site_id: String) -> Result<StackState, String> {
    let sid = site_id.clone();
    tauri::async_runtime::spawn_blocking(move || crate::stack::sites::start_site_process(&sid))
        .await
        .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

#[tauri::command]
pub async fn stack_stop_site(site_id: String) -> Result<StackState, String> {
    let sid = site_id.clone();
    tauri::async_runtime::spawn_blocking(move || crate::stack::sites::stop_site_process(&sid))
        .await
        .map_err(|e| e.to_string())??;
    Ok(build_stack_state())
}

// ── 数据库管理 ──

#[tauri::command]
pub fn db_create_database(engine: DbEngine, database: String, charset: String, collation: String) -> Result<(), String> {
    manager::create_database(engine, &database, &charset, &collation)
}

#[tauri::command]
pub fn db_set_root_password(engine: DbEngine, password: String) -> Result<(), String> {
    manager::set_root_password(engine, &password)
}

#[tauri::command]
pub fn db_list_databases(engine: DbEngine) -> Result<Vec<DbInfo>, String> {
    manager::list_databases(engine)
}

#[tauri::command]
pub fn db_list_tables(engine: DbEngine, database: String) -> Result<Vec<String>, String> {
    manager::list_tables(engine, &database)
}

#[tauri::command]
pub fn db_import(engine: DbEngine, database: String, file_path: String) -> Result<(), String> {
    manager::import_database(engine, &database, &file_path)
}

#[derive(Debug, serde::Deserialize)]
pub struct DbExportParams {
    pub engine: DbEngine,
    pub database: String,
    pub output_path: String,
    #[serde(default)]
    pub tables: Vec<String>,
    #[serde(default)]
    pub gzip: bool,
}

#[tauri::command]
pub fn db_pick_sql_file() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择 SQL 文件")
        .add_filter("SQL", &["sql", "gz", "zip"])
        .pick_file();
    Ok(picked.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn db_pick_export_dir() -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("选择导出目录")
        .pick_folder();
    Ok(picked.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn db_export(params: DbExportParams) -> Result<(), String> {
    manager::export_database(params.engine, &params.database, &params.output_path, params.tables, params.gzip)
}

// ── Redis 管理 ──

#[tauri::command]
pub fn redis_set_password(password: String) -> Result<(), String> {
    crate::stack::redis::set_password(&password)
}

#[tauri::command]
pub fn redis_get_password() -> Result<Option<String>, String> {
    crate::stack::redis::get_password()
}
