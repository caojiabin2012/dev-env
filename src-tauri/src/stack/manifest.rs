use crate::stack::types::DbEngine;

#[derive(Debug, Clone, Copy)]
pub struct VersionEntry {
    pub id: &'static str,
    pub label: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub mirror_urls: &'static [&'static str],
    pub engine: Option<DbEngine>,
}

macro_rules! php_entry {
    ($id:expr, $label:expr, $ver:expr, $toolchain:expr) => {
        php_entry!(@inner $id, $label, $ver, $toolchain, "releases")
    };
    ($id:expr, $label:expr, $ver:expr, $toolchain:expr, archive) => {
        php_entry!(@inner $id, $label, $ver, $toolchain, "releases/archives")
    };
    (@inner $id:expr, $label:expr, $ver:expr, $toolchain:expr, $path:expr) => {
        VersionEntry {
            id: $id,
            label: $label,
            filename: concat!("php-", $ver, "-nts-Win32-", $toolchain, "-x64.zip"),
            url: concat!(
                "https://downloads.php.net/~windows/",
                $path,
                "/php-",
                $ver,
                "-nts-Win32-",
                $toolchain,
                "-x64.zip"
            ),
            mirror_urls: &[concat!(
                "https://windows.php.net/downloads/",
                $path,
                "/php-",
                $ver,
                "-nts-Win32-",
                $toolchain,
                "-x64.zip"
            )],
            engine: None,
        }
    };
}

macro_rules! redis_entry {
    ($id:expr, $label:expr, $tag:expr, $file:literal) => {
        VersionEntry {
            id: $id,
            label: $label,
            filename: $file,
            url: concat!(
                "https://ghfast.top/https://github.com/redis-windows/redis-windows/releases/download/",
                $tag,
                "/",
                $file
            ),
            mirror_urls: &[concat!(
                "https://github.com/redis-windows/redis-windows/releases/download/",
                $tag,
                "/",
                $file
            )],
            engine: None,
        }
    };
}

macro_rules! rabbitmq_entry {
    ($ver:expr) => {
        VersionEntry {
            id: $ver,
            label: concat!("RabbitMQ ", $ver),
            filename: concat!("rabbitmq-server-windows-", $ver, ".zip"),
            url: concat!(
                "https://ghfast.top/https://github.com/rabbitmq/rabbitmq-server/releases/download/v",
                $ver,
                "/rabbitmq-server-windows-",
                $ver,
                ".zip"
            ),
            mirror_urls: &[concat!(
                "https://github.com/rabbitmq/rabbitmq-server/releases/download/v",
                $ver,
                "/rabbitmq-server-windows-",
                $ver,
                ".zip"
            )],
            engine: None,
        }
    };
}

macro_rules! rocketmq_entry {
    ($ver:expr) => {
        VersionEntry {
            id: $ver,
            label: concat!("RocketMQ ", $ver),
            filename: concat!("rocketmq-all-", $ver, "-bin-release.zip"),
            url: concat!(
                "https://ghfast.top/https://dist.apache.org/repos/dist/release/rocketmq/",
                $ver,
                "/rocketmq-all-",
                $ver,
                "-bin-release.zip"
            ),
            mirror_urls: &[concat!(
                "https://dist.apache.org/repos/dist/release/rocketmq/",
                $ver,
                "/rocketmq-all-",
                $ver,
                "-bin-release.zip"
            )],
            engine: None,
        }
    };
}

macro_rules! kafka_entry {
    ($ver:expr, $scala:expr) => {
        VersionEntry {
            id: $ver,
            label: concat!("Kafka ", $ver),
            filename: concat!("kafka_", $scala, "-", $ver, ".tgz"),
            url: concat!(
                "https://ghfast.top/https://downloads.apache.org/kafka/",
                $ver,
                "/kafka_",
                $scala,
                "-",
                $ver,
                ".tgz"
            ),
            mirror_urls: &[concat!(
                "https://downloads.apache.org/kafka/",
                $ver,
                "/kafka_",
                $scala,
                "-",
                $ver,
                ".tgz"
            )],
            engine: None,
        }
    };
}

macro_rules! node_entry {
    ($ver:expr, $label:expr) => {
        VersionEntry {
            id: $ver,
            label: $label,
            filename: concat!("node-v", $ver, "-win-x64.zip"),
            url: concat!(
                "https://nodejs.org/dist/v",
                $ver,
                "/node-v",
                $ver,
                "-win-x64.zip"
            ),
            mirror_urls: &[concat!(
                "https://npmmirror.com/mirrors/node/v",
                $ver,
                "/node-v",
                $ver,
                "-win-x64.zip"
            )],
            engine: None,
        }
    };
}

macro_rules! python_entry {
    ($ver:expr, $label:expr) => {
        VersionEntry {
            id: $ver,
            label: $label,
            filename: concat!("python-", $ver, "-embed-amd64.zip"),
            url: concat!(
                "https://www.python.org/ftp/python/",
                $ver,
                "/python-",
                $ver,
                "-embed-amd64.zip"
            ),
            mirror_urls: &[concat!(
                "https://ghfast.top/https://www.python.org/ftp/python/",
                $ver,
                "/python-",
                $ver,
                "-embed-amd64.zip"
            )],
            engine: None,
        }
    };
}

macro_rules! go_entry {
    ($ver:expr, $label:expr) => {
        VersionEntry {
            id: $ver,
            label: $label,
            filename: concat!("go", $ver, ".windows-amd64.zip"),
            url: concat!("https://go.dev/dl/go", $ver, ".windows-amd64.zip"),
            mirror_urls: &[concat!(
                "https://golang.google.cn/dl/go",
                $ver,
                ".windows-amd64.zip"
            )],
            engine: None,
        }
    };
}

macro_rules! java_entry {
    ($feature:literal, $build:literal, $label:expr) => {
        VersionEntry {
            id: $feature,
            label: $label,
            filename: concat!(
                "bellsoft-jdk",
                $feature,
                "+",
                $build,
                "-windows-amd64.zip"
            ),
            url: concat!(
                "https://download.bell-sw.com/java/",
                $feature,
                "+",
                $build,
                "/bellsoft-jdk",
                $feature,
                "+",
                $build,
                "-windows-amd64",
                ".zip"
            ),
            mirror_urls: &[],
            engine: None,
        }
    };
}

#[derive(Debug, Clone, Copy)]
pub struct ComponentManifest {
    pub id: &'static str,
    pub name: &'static str,
    pub default_port: u16,
    pub default_version_id: &'static str,
    pub versions: &'static [VersionEntry],
}

pub const WINDOWS_COMPONENTS: &[ComponentManifest] = &[
    ComponentManifest {
        id: "mysql",
        name: "MySQL",
        default_port: 3307,
        default_version_id: "mysql-8.4.10",
        versions: &[
            VersionEntry {
                id: "mysql-8.4.10",
                label: "MySQL 8.4.10",
                filename: "mysql-8.4.10-winx64.zip",
                url: "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.10-winx64.zip",
                mirror_urls: &[],
                engine: Some(DbEngine::Mysql),
            },
            VersionEntry {
                id: "mysql-8.4.9",
                label: "MySQL 8.4.9",
                filename: "mysql-8.4.9-winx64.zip",
                url: "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.9-winx64.zip",
                mirror_urls: &[],
                engine: Some(DbEngine::Mysql),
            },
            VersionEntry {
                id: "mysql-8.4.8",
                label: "MySQL 8.4.8",
                filename: "mysql-8.4.8-winx64.zip",
                url: "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.8-winx64.zip",
                mirror_urls: &[],
                engine: Some(DbEngine::Mysql),
            },
            VersionEntry {
                id: "mysql-8.0.46",
                label: "MySQL 8.0.46",
                filename: "mysql-8.0.46-winx64.zip",
                url: "https://cdn.mysql.com/Downloads/MySQL-8.0/mysql-8.0.46-winx64.zip",
                mirror_urls: &[],
                engine: Some(DbEngine::Mysql),
            },
        ],
    },
    ComponentManifest {
        id: "mariadb",
        name: "MariaDB",
        default_port: 3308,
        default_version_id: "mariadb-11.4.2",
        versions: &[
            VersionEntry {
                id: "mariadb-11.4.2",
                label: "MariaDB 11.4.2",
                filename: "mariadb-11.4.2-winx64.zip",
                url: "https://archive.mariadb.org/mariadb-11.4.2/winx64-packages/mariadb-11.4.2-winx64.zip",
                mirror_urls: &[],
                engine: Some(DbEngine::MariaDb),
            },
        ],
    },
    ComponentManifest {
        id: "caddy",
        name: "Caddy",
        default_port: 8083,
        default_version_id: "2.9.1",
        versions: &[
            VersionEntry {
                id: "2.9.1",
                label: "Caddy 2.9.1",
                filename: "caddy_2.9.1_windows_amd64.zip",
                url: "https://ghfast.top/https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_windows_amd64.zip",
                mirror_urls: &["https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_windows_amd64.zip"],
                engine: None,
            },
            VersionEntry {
                id: "2.8.4",
                label: "Caddy 2.8.4",
                filename: "caddy_2.8.4_windows_amd64.zip",
                url: "https://ghfast.top/https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_windows_amd64.zip",
                mirror_urls: &["https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_windows_amd64.zip"],
                engine: None,
            },
        ],
    },
    ComponentManifest {
        id: "php",
        name: "PHP",
        default_port: 9001,
        default_version_id: "8.3.32",
        versions: &[
            php_entry!("8.5.8", "PHP 8.5.8", "8.5.8", "vs17", archive),
            php_entry!("8.4.16", "PHP 8.4.16", "8.4.16", "vs17"),
            php_entry!("8.4.9", "PHP 8.4.9", "8.4.9", "vs17"),
            php_entry!("8.3.32", "PHP 8.3.32", "8.3.32", "vs17"),
            php_entry!("8.3.23", "PHP 8.3.23", "8.3.23", "vs17"),
            php_entry!("8.2.28", "PHP 8.2.28", "8.2.28", "vs17"),
            php_entry!("8.2.15", "PHP 8.2.15", "8.2.15", "vs17"),
            php_entry!("8.1.31", "PHP 8.1.31", "8.1.31", "vs17", archive),
        ],
    },
    ComponentManifest {
        id: "nginx",
        name: "Nginx",
        default_port: 8080,
        default_version_id: "1.26.3",
        versions: &[
            VersionEntry {
                id: "1.26.3",
                label: "Nginx 1.26.3",
                filename: "nginx-1.26.3.zip",
                url: "https://nginx.org/download/nginx-1.26.3.zip",
                mirror_urls: &["https://mirrors.huaweicloud.com/nginx/nginx-1.26.3.zip"],
                engine: None,
            },
            VersionEntry {
                id: "1.25.5",
                label: "Nginx 1.25.5",
                filename: "nginx-1.25.5.zip",
                url: "https://nginx.org/download/nginx-1.25.5.zip",
                mirror_urls: &["https://mirrors.huaweicloud.com/nginx/nginx-1.25.5.zip"],
                engine: None,
            },
            VersionEntry {
                id: "1.24.0",
                label: "Nginx 1.24.0",
                filename: "nginx-1.24.0.zip",
                url: "https://nginx.org/download/nginx-1.24.0.zip",
                mirror_urls: &["https://mirrors.huaweicloud.com/nginx/nginx-1.24.0.zip"],
                engine: None,
            },
        ],
    },
    ComponentManifest {
        id: "openresty",
        name: "OpenResty",
        default_port: 8081,
        default_version_id: "1.27.1.2",
        versions: &[
            VersionEntry {
                id: "1.27.1.2",
                label: "OpenResty 1.27.1.2",
                filename: "openresty-1.27.1.2-win64.zip",
                url: "https://openresty.org/download/openresty-1.27.1.2-win64.zip",
                mirror_urls: &[],
                engine: None,
            },
        ],
    },
    ComponentManifest {
        id: "composer",
        name: "Composer",
        default_port: 0,
        default_version_id: "2.8.12",
        versions: &[
            VersionEntry {
                id: "2.8.12",
                label: "Composer 2.8.12",
                filename: "composer-2.8.12.phar",
                url: "https://getcomposer.org/download/2.8.12/composer.phar",
                mirror_urls: &[],
                engine: None,
            },
            VersionEntry {
                id: "2.7.23",
                label: "Composer 2.7.23",
                filename: "composer-2.7.23.phar",
                url: "https://getcomposer.org/download/2.7.23/composer.phar",
                mirror_urls: &[],
                engine: None,
            },
            VersionEntry {
                id: "2.2.25",
                label: "Composer 2.2.25 (LTS)",
                filename: "composer-2.2.25.phar",
                url: "https://getcomposer.org/download/2.2.25/composer.phar",
                mirror_urls: &[],
                engine: None,
            },
        ],
    },
    ComponentManifest {
        id: "python",
        name: "Python",
        default_port: 0,
        default_version_id: "3.13.14",
        versions: &[
            python_entry!("3.14.6", "Python 3.14.6"),
            python_entry!("3.13.14", "Python 3.13.14"),
            python_entry!("3.12.10", "Python 3.12.10"),
            python_entry!("3.12.8", "Python 3.12.8"),
            python_entry!("3.11.9", "Python 3.11.9"),
            python_entry!("3.10.11", "Python 3.10.11"),
        ],
    },
    ComponentManifest {
        id: "pip",
        name: "pip",
        default_port: 0,
        default_version_id: "latest",
        versions: &[VersionEntry {
            id: "latest",
            label: "pip (bootstrap)",
            filename: "get-pip.py",
            url: "https://bootstrap.pypa.io/get-pip.py",
            mirror_urls: &["https://ghfast.top/https://raw.githubusercontent.com/pypa/get-pip/main/public/get-pip.py"],
            engine: None,
        }],
    },
    ComponentManifest {
        id: "go",
        name: "Go",
        default_port: 0,
        default_version_id: "1.26.4",
        versions: &[
            go_entry!("1.26.4", "Go 1.26.4"),
            go_entry!("1.25.11", "Go 1.25.11"),
            go_entry!("1.24.13", "Go 1.24.13"),
            go_entry!("1.23.12", "Go 1.23.12"),
            go_entry!("1.23.4", "Go 1.23.4"),
            go_entry!("1.22.12", "Go 1.22.12"),
            go_entry!("1.22.10", "Go 1.22.10"),
            go_entry!("1.21.13", "Go 1.21.13"),
        ],
    },
    ComponentManifest {
        id: "java",
        name: "Java",
        default_port: 0,
        default_version_id: "21.0.11",
        versions: &[
            java_entry!("21.0.11", "12", "Java 21.0.11 LTS (Liberica)"),
            java_entry!("17.0.18", "10", "Java 17.0.18 LTS (Liberica)"),
            java_entry!("8u372", "7", "Java 1.8.0_372 LTS (Liberica)"),
        ],
    },
    ComponentManifest {
        id: "node",
        name: "Node.js",
        default_port: 0,
        default_version_id: "24.18.0",
        versions: &[
            node_entry!("26.4.0", "Node.js 26.4.0 (Current)"),
            node_entry!("24.18.0", "Node.js 24.18.0 LTS"),
            node_entry!("22.23.1", "Node.js 22.23.1 LTS"),
            node_entry!("22.12.0", "Node.js 22.12.0 LTS"),
            node_entry!("20.20.2", "Node.js 20.20.2 LTS"),
            node_entry!("20.18.1", "Node.js 20.18.1 LTS"),
            node_entry!("18.20.8", "Node.js 18.20.8 LTS"),
            node_entry!("18.20.5", "Node.js 18.20.5 LTS"),
        ],
    },
    ComponentManifest {
        id: "npm",
        name: "npm",
        default_port: 0,
        default_version_id: "bundled",
        versions: &[VersionEntry {
            id: "bundled",
            label: "npm (随 Node.js)",
            filename: "npm-bundled.marker",
            url: "https://nodejs.org/dist/index.json",
            mirror_urls: &[],
            engine: None,
        }],
    },
    ComponentManifest {
        id: "redis",
        name: "Redis",
        default_port: 6379,
        default_version_id: "7.4.9",
        versions: &[
            redis_entry!(
                "7.4.9",
                "Redis 7.4.9",
                "7.4.9",
                "Redis-7.4.9-Windows-x64-msys2.zip"
            ),
            redis_entry!(
                "7.2.14",
                "Redis 7.2.14",
                "7.2.14",
                "Redis-7.2.14-Windows-x64-msys2.zip"
            ),
            redis_entry!(
                "7.0.15",
                "Redis 7.0.15",
                "7.0.15",
                "Redis-7.0.15-Windows-x64-msys2.zip"
            ),
            VersionEntry {
                id: "5.0.14.1",
                label: "Redis 5.0.14.1（旧版）",
                filename: "Redis-x64-5.0.14.1.zip",
                url: "https://ghfast.top/https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip",
                mirror_urls: &["https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"],
                engine: None,
            },
        ],
    },
    ComponentManifest {
        id: "rocketmq",
        name: "RocketMQ",
        default_port: 9876,
        default_version_id: "5.3.2",
        versions: &[
            rocketmq_entry!("5.3.2"),
            rocketmq_entry!("5.3.1"),
            rocketmq_entry!("5.2.0"),
            rocketmq_entry!("4.9.8"),
        ],
    },
    ComponentManifest {
        id: "kafka",
        name: "Kafka",
        default_port: 9092,
        default_version_id: "3.9.0",
        versions: &[
            kafka_entry!("3.9.0", "2.13"),
            kafka_entry!("3.8.1", "2.13"),
            kafka_entry!("3.7.2", "2.13"),
            kafka_entry!("3.6.2", "2.13"),
        ],
    },
    ComponentManifest {
        id: "rabbitmq",
        name: "RabbitMQ",
        default_port: 5672,
        default_version_id: "4.3.2",
        versions: &[
            // 新版本在上；每个小版本线保留最终稳定版
            rabbitmq_entry!("4.3.2"),
            rabbitmq_entry!("4.2.8"),
            rabbitmq_entry!("4.1.8"),
            rabbitmq_entry!("4.0.9"),
            rabbitmq_entry!("3.13.7"),
            rabbitmq_entry!("3.12.14"),
        ],
    },
];

pub fn get_component(id: &str) -> Result<&'static ComponentManifest, String> {
    WINDOWS_COMPONENTS
        .iter()
        .find(|c| c.id == id)
        .ok_or_else(|| format!("未知组件: {id}"))
}

pub fn find_version(component_id: &str, version_id: &str) -> Result<&'static VersionEntry, String> {
    let comp = get_component(component_id)?;
    comp.versions
        .iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| format!("未知版本: {component_id}@{version_id}"))
}

pub fn resolve_version(
    component_id: &str,
    version_id: Option<&str>,
) -> Result<(&'static ComponentManifest, &'static VersionEntry), String> {
    let comp = get_component(component_id)?;
    let id = version_id.unwrap_or(comp.default_version_id);
    let ver = find_version(component_id, id)?;
    Ok((comp, ver))
}

pub fn default_version_id(component_id: &str) -> Result<&'static str, String> {
    Ok(get_component(component_id)?.default_version_id)
}

/// 兼容旧接口
pub fn get(id: &str) -> Result<LegacyManifest, String> {
    let (comp, ver) = resolve_version(id, None)?;
    Ok(LegacyManifest {
        id: comp.id,
        name: comp.name,
        version: ver.label,
        filename: ver.filename,
        url: ver.url,
        default_port: comp.default_port,
    })
}

pub struct LegacyManifest {
    pub id: &'static str,
    pub name: &'static str,
    pub version: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub default_port: u16,
}
