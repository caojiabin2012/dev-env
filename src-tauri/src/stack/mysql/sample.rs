use std::path::Path;

use crate::stack::process_util::{is_port_listening, run_command_in};
use crate::stack::types::MysqlInstall;

const INIT_SQL: &str = r"
CREATE DATABASE IF NOT EXISTS `test` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `test`;
CREATE TABLE IF NOT EXISTS `demo_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `email` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO `demo_users` (`id`, `name`, `email`) VALUES
(1, 'Alice', 'alice@example.com'),
(2, 'Bob', 'bob@example.com');
";

/// 在 MariaDB/MySQL 运行后创建 test 库与 demo_users 表（幂等）。
pub fn ensure_test_database(install: &MysqlInstall) -> Result<(), String> {
    if !is_port_listening(install.port) {
        return Ok(());
    }

    let home = Path::new(&install.home_dir);
    let client = resolve_mysql_client(home)?;
    let bin_dir = home.join("bin");
    let port = install.port.to_string();

    let output = run_command_in(
        &client,
        Some(&bin_dir),
        &["-h", "127.0.0.1", "-u", "root", "-P", &port, "-e", INIT_SQL],
    )?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "初始化 test 数据库失败:\n{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn resolve_mysql_client(home: &Path) -> Result<std::path::PathBuf, String> {
    for name in ["mariadb.exe", "mysql.exe"] {
        let path = home.join("bin").join(name);
        if path.exists() {
            return Ok(path);
        }
    }
    Err(format!(
        "未找到 mysql/mariadb 客户端: {}",
        home.join("bin").display()
    ))
}
