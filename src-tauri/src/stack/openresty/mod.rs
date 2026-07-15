use std::path::{Path, PathBuf};

use crate::stack::types::{NginxInstall, StackStore};
use crate::stack::webserver::nginx_family::{self, NginxFamilyKind};

const KIND: NginxFamilyKind = NginxFamilyKind::OpenResty;

pub fn install(
    source_path: Option<&str>,
    port: u16,
    version_name: &str,
    version_id: Option<&str>,
) -> Result<NginxInstall, String> {
    nginx_family::install(KIND, source_path, port, version_name, version_id)
}

pub fn write_config(
    install: &NginxInstall,
    php_port: u16,
    store: &StackStore,
    install_root: &Path,
) -> Result<(), String> {
    nginx_family::write_config(KIND, install, php_port, store, install_root)
}

pub fn reload_if_running(install: &NginxInstall) -> Result<(), String> {
    nginx_family::reload_if_running(install)
}

pub fn uninstall() -> Result<(), String> {
    nginx_family::uninstall(KIND)
}

pub fn start() -> Result<NginxInstall, String> {
    nginx_family::start(KIND)
}

pub fn stop(install: &NginxInstall) -> Result<(), String> {
    nginx_family::stop(KIND, install)
}

pub fn stop_from_store() -> Result<NginxInstall, String> {
    nginx_family::stop_from_store(KIND)
}

pub fn status(install: &NginxInstall) -> crate::stack::types::ServiceStatus {
    nginx_family::status(install)
}

pub fn log_path(install: &NginxInstall) -> PathBuf {
    nginx_family::log_path(install)
}

pub fn runtime_conf_path(install: &NginxInstall) -> PathBuf {
    nginx_family::runtime_conf_path(install)
}
