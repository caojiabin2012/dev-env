use std::path::Path;

use crate::stack::store::require_install_root;
use crate::stack::types::StackStore;

pub fn sync_all_configs() -> Result<(), String> {
    let store = crate::stack::store::load_store();
    let root = require_install_root()?;
    sync_configs(&store, &root)
}

pub fn sync_configs(store: &StackStore, install_root: &Path) -> Result<(), String> {
    if let Some(mysql) = &store.mysql {
        crate::stack::mysql::config::write_config(install_root, mysql)?;
    }
    if let Some(mariadb) = &store.mariadb {
        crate::stack::mysql::config::write_config(install_root, mariadb)?;
    }
    if let Some(php) = &store.php {
        crate::stack::php::write_config(install_root, php)?;
    }
    crate::stack::composer::sync_if_installed(store, install_root)?;
    crate::stack::pip::sync_if_installed(store, install_root)?;
    crate::stack::npm::sync_if_installed(store, install_root)?;
    if let Some(redis) = &store.redis {
        crate::stack::redis::write_config(install_root, redis)?;
    }
    if let Some(rabbitmq) = &store.rabbitmq {
        crate::stack::rabbitmq::write_config(install_root, rabbitmq)?;
    }
    if let Some(nginx) = &store.nginx {
        let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
        crate::stack::nginx::write_config(nginx, php_port, store, install_root)?;
        let _ = crate::stack::nginx::reload_if_running(nginx);
    }
    if let Some(openresty) = &store.openresty {
        let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
        crate::stack::openresty::write_config(openresty, php_port, store, install_root)?;
        let _ = crate::stack::openresty::reload_if_running(openresty);
    }
    if let Some(caddy) = &store.caddy {
        let php_port = store.php.as_ref().map(|p| p.port).unwrap_or(9000);
        crate::stack::caddy::write_config(caddy, php_port, store, install_root)?;
        let _ = crate::stack::caddy::reload_if_running(caddy);
    }
    crate::stack::www::sync_site_files(store, install_root)?;
    Ok(())
}
