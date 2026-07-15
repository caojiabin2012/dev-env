use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

use crate::stack::types::*;

pub fn db_path() -> PathBuf {
    crate::app_paths::app_data_dir().join("stack").join("stack.db")
}

fn open() -> Result<Connection, String> {
    Connection::open(db_path()).map_err(|e| format!("打开旧数据库失败: {e}"))
}

pub fn migrate_to_json_if_needed(json_path: &Path) -> Result<bool, String> {
    if json_path.exists() || !db_path().exists() {
        return Ok(false);
    }

    let mut store = load_legacy_store()?;
    if store.install_root.as_deref() == Some("") {
        store.install_root = None;
    }
    crate::stack::sites::ensure_default_site(&mut store);

    if let Some(parent) = json_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(json_path, json).map_err(|e| e.to_string())?;

    let db = db_path();
    let _ = fs::rename(&db, db.with_extension("db.bak"));
    Ok(true)
}

fn get_str(conn: &Connection, sql: &str, default: &str) -> String {
    conn.query_row(sql, [], |r| r.get(0))
        .unwrap_or_else(|_| default.to_string())
}

fn load_legacy_store() -> Result<StackStore, String> {
    let conn = open()?;

    let mysql = load_one_comp(&conn, "mysql", |r| {
        Ok(MysqlInstall {
            engine: DbEngine::Mysql,
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
            initialized: r.get::<_, i32>(5)? != 0,
            root_password: r.get(6)?,
        })
    });
    let mariadb = load_one_comp(&conn, "mariadb", |r| {
        Ok(MysqlInstall {
            engine: DbEngine::MariaDb,
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
            initialized: r.get::<_, i32>(5)? != 0,
            root_password: r.get(6)?,
        })
    });
    let nginx = load_one_comp(&conn, "nginx", |r| {
        Ok(NginxInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
        })
    });
    let openresty = load_one_comp(&conn, "openresty", |r| {
        Ok(NginxInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
        })
    });
    let caddy = load_one_comp(&conn, "caddy", |r| {
        Ok(NginxInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
        })
    });
    let kafka = load_one_comp(&conn, "kafka", |r| {
        Ok(NginxInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
        })
    });
    let rocketmq = load_one_comp(&conn, "rocketmq", |r| {
        Ok(RocketMqInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            broker_port: 10911,
            pid: r.get(4)?,
            namesrv_pid: None,
        })
    });
    let php = load_one_comp(&conn, "php", |r| {
        Ok(PhpInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
        })
    });
    let composer = load_one_comp(&conn, "composer", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let python = load_one_comp(&conn, "python", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let pip = load_one_comp(&conn, "pip", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let go = load_one_comp(&conn, "go", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let java = load_one_comp(&conn, "java", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let node = load_one_comp(&conn, "node", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let npm = load_one_comp(&conn, "npm", |r| {
        Ok(CliInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
        })
    });
    let redis = load_one_comp(&conn, "redis", |r| {
        Ok(RedisInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            port: r.get(3)?,
            pid: r.get(4)?,
            password: r.get(5)?,
        })
    });
    let rabbitmq = load_one_comp(&conn, "rabbitmq", |r| {
        Ok(RabbitMqInstall {
            version_label: r.get(1)?,
            home_dir: r.get(2)?,
            erlang_home: r.get(3)?,
            port: r.get(4)?,
            mgmt_port: r.get(5)?,
            delayed_plugin: r.get::<_, i32>(6)? != 0,
            pid: r.get(7)?,
        })
    });

    Ok(StackStore {
        install_root: get_str(&conn, "SELECT value FROM meta WHERE key='install_root'", "").into(),
        mysql,
        mariadb,
        nginx,
        openresty,
        php,
        composer,
        python,
        pip,
        go,
        java,
        node,
        npm,
        redis,
        caddy,
        rabbitmq,
        kafka,
        rocketmq,
        version_prefs: {
            let mut map = std::collections::HashMap::new();
            if let Ok(mut stmt) = conn.prepare("SELECT component_id, version_id FROM version_prefs")
            {
                if let Ok(rows) =
                    stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
                {
                    for row in rows.flatten() {
                        map.insert(row.0, row.1);
                    }
                }
            }
            map
        },
        version_statuses: load_version_statuses(&conn),
        settings: StackSettings {
            www_subdir: get_str(
                &conn,
                "SELECT value FROM settings WHERE key='www_subdir'",
                "www/default",
            ),
            boot_autostart: serde_json::from_str(&get_str(
                &conn,
                "SELECT value FROM settings WHERE key='boot_autostart'",
                "{}",
            ))
            .unwrap_or_default(),
            dashboard_cards: serde_json::from_str(&get_str(
                &conn,
                "SELECT value FROM settings WHERE key='dashboard_cards'",
                "[]",
            ))
            .unwrap_or_else(|_| default_dashboard_cards()),
            path_env: serde_json::from_str(&get_str(
                &conn,
                "SELECT value FROM settings WHERE key='path_env'",
                "{}",
            ))
            .unwrap_or_default(),
        },
        sites: {
            let mut sites = Vec::new();
            if let Ok(mut stmt) = conn.prepare(
                "SELECT id,name,hostname,root,enabled,is_default,runtime,runtime_version_id,web_server,port FROM sites",
            ) {
                if let Ok(rows) = stmt.query_map([], |r| {
                    Ok(WebSite {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        hostname: r.get(2)?,
                        root: r.get(3)?,
                        enabled: r.get::<_, i32>(4)? != 0,
                        is_default: r.get::<_, i32>(5)? != 0,
                        runtime: r.get(6)?,
                        runtime_version_id: r.get(7)?,
                        web_server: r.get(8)?,
                        port: r.get(9)?,
                    })
                }) {
                    sites = rows.flatten().collect();
                }
            }
            sites
        },
        site_processes: {
            let mut map = std::collections::HashMap::new();
            if let Ok(mut stmt) = conn.prepare("SELECT site_id, port, pid FROM site_processes") {
                if let Ok(rows) = stmt.query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        SiteProcess {
                            site_id: r.get(0)?,
                            port: r.get(1)?,
                            pid: r.get(2)?,
                        },
                    ))
                }) {
                    for row in rows.flatten() {
                        map.insert(row.0, row.1);
                    }
                }
            }
            map
        },
    })
}

fn load_one_comp<T>(
    conn: &Connection,
    id: &str,
    f: fn(&rusqlite::Row) -> rusqlite::Result<T>,
) -> Option<T> {
    let sql = format!(
        "SELECT id, version_label, home_dir, port, pid, initialized, root_password, erlang_home, mgmt_port, delayed_plugin, password FROM components WHERE id='{id}' LIMIT 1"
    );
    conn.prepare(&sql).ok()?.query_row([], f).ok()
}

fn load_version_statuses(conn: &Connection) -> Vec<ComponentVersionStatus> {
    let mut out = Vec::new();
    let Ok(mut stmt) = conn.prepare(
        "SELECT component_id, version_id, version_label, downloaded, installed, is_active, home_dir, port
         FROM component_versions",
    ) else {
        return out;
    };
    let Ok(rows) = stmt.query_map([], |r| {
        Ok(ComponentVersionStatus {
            component_id: r.get(0)?,
            version_id: r.get(1)?,
            version_label: r.get(2)?,
            downloaded: r.get::<_, i32>(3)? != 0,
            installed: r.get::<_, i32>(4)? != 0,
            is_active: r.get::<_, i32>(5)? != 0,
            home_dir: r.get(6)?,
            port: r.get::<_, i64>(7).unwrap_or(0) as u16,
        })
    }) else {
        return out;
    };
    out.extend(rows.flatten());
    out
}
