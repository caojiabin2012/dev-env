use crate::stack::manifest;
use crate::stack::types::{StackStore, WebSite};

pub const RUNTIME_IDS: &[&str] = &["php", "python", "go", "node", "static"];
const WEB_SERVER_IDS: &[&str] = &["nginx", "openresty", "caddy"];

pub fn web_server_label(id: &str) -> &'static str {
    match id {
        "nginx" => "Nginx",
        "openresty" => "OpenResty",
        _ => "Web 服务",
    }
}

pub fn validate_web_server(web_server: &str) -> Result<(), String> {
    if WEB_SERVER_IDS.contains(&web_server) {
        Ok(())
    } else {
        Err(format!("不支持的 Web 服务器: {web_server}"))
    }
}

pub fn resolve_web_server(web_server: &str, store: &StackStore) -> Result<String, String> {
    validate_web_server(web_server)?;
    if crate::stack::sites::web_install(store, web_server).is_some() {
        return Ok(web_server.to_string());
    }
    Err(format!(
        "{} 尚未安装，请先在 Packages 中安装",
        web_server_label(web_server)
    ))
}

pub fn default_web_server(store: &StackStore) -> Option<String> {
    WEB_SERVER_IDS
        .iter()
        .find(|id| crate::stack::sites::web_install(store, id).is_some())
        .map(|id| (*id).to_string())
}

pub fn runtime_label(runtime: &str) -> &'static str {
    match runtime {
        "php" => "PHP",
        "python" => "Python",
        "go" => "Go",
        "node" => "Node.js",
        "static" => "静态",
        _ => "未知",
    }
}

pub fn validate_runtime(runtime: &str) -> Result<(), String> {
    if RUNTIME_IDS.contains(&runtime) {
        Ok(())
    } else {
        Err(format!("不支持的站点运行时: {runtime}"))
    }
}

pub fn default_version_id(runtime: &str) -> Result<Option<String>, String> {
    if runtime == "static" {
        return Ok(None);
    }
    let comp = manifest::get_component(runtime)?;
    Ok(Some(comp.default_version_id.to_string()))
}

pub fn resolve_version_id(runtime: &str, version_id: Option<&str>) -> Result<Option<String>, String> {
    if runtime == "static" {
        return Ok(None);
    }
    let vid = version_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| default_version_id(runtime).unwrap_or_default().unwrap_or_default());
    manifest::find_version(runtime, &vid)?;
    Ok(Some(vid))
}

pub fn runtime_display(runtime: &str, version_id: Option<&str>) -> String {
    if runtime == "static" {
        return "静态 HTML".into();
    }
    let name = runtime_label(runtime);
    match version_id {
        Some(v) => format!("{name} {v}"),
        None => name.to_string(),
    }
}

pub fn version_label(runtime: &str, version_id: &str) -> Result<String, String> {
    let ver = manifest::find_version(runtime, version_id)?;
    Ok(ver.label.to_string())
}

pub fn site_runtime_ready(store: &StackStore, site: &WebSite) -> bool {
    if site.runtime == "static" {
        return true;
    }
    let Some(vid) = site.runtime_version_id.as_deref() else {
        return false;
    };
    if !is_runtime_installed(store, &site.runtime) {
        return false;
    }
    store
        .version_prefs
        .get(&site.runtime)
        .map(|installed| installed == vid)
        .unwrap_or(false)
}

fn is_runtime_installed(store: &StackStore, runtime: &str) -> bool {
    match runtime {
        "php" => store.php.is_some(),
        "python" => store.python.is_some(),
        "go" => store.go.is_some(),
        "node" => store.node.is_some(),
        _ => false,
    }
}

pub fn apply_site_version_pref(store: &mut StackStore, site: &WebSite) {
    if site.runtime == "static" {
        return;
    }
    if let Some(vid) = &site.runtime_version_id {
        store.version_prefs.insert(site.runtime.clone(), vid.clone());
    }
}

pub fn default_site_fields(store: &StackStore) -> (String, Option<String>, String) {
    let runtime = "php".to_string();
    let version_id = store
        .version_prefs
        .get("php")
        .cloned()
        .or_else(|| default_version_id("php").ok().flatten());
    let web_server = default_web_server(store).unwrap_or_else(|| "nginx".to_string());
    (runtime, version_id, web_server)
}
