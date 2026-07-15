use std::path::Path;
use std::process::Command;

use crate::stack::store::load_store;
use crate::stack::types::DbEngine;

fn db_engine_key(engine: DbEngine) -> &'static str {
    match engine {
        DbEngine::Mysql => "mysql",
        DbEngine::MariaDb => "mariadb",
    }
}

fn mysql_bin(engine: DbEngine, tool: &str) -> Result<String, String> {
    let store = load_store();
    let install = match engine {
        DbEngine::Mysql => store.mysql.as_ref(),
        DbEngine::MariaDb => store.mariadb.as_ref(),
    }
    .ok_or("数据库未安装")?;

    let bin = Path::new(&install.home_dir).join("bin").join(format!("{tool}.exe"));
    if bin.exists() {
        Ok(bin.to_string_lossy().into_owned())
    } else {
        Err(format!("找不到 {tool}.exe，路径: {}", bin.display()))
    }
}

fn get_auth(engine: DbEngine) -> Result<(String, Option<String>), String> {
    let store = load_store();
    let install = match engine {
        DbEngine::Mysql => store.mysql.as_ref(),
        DbEngine::MariaDb => store.mariadb.as_ref(),
    }
    .ok_or("数据库未安装")?;
    let port = install.port;
    let pass = install.root_password.clone();
    Ok((format!("127.0.0.1:{}", port), pass))
}

/// 创建数据库
pub fn create_database(engine: DbEngine, database: &str, charset: &str, collation: &str) -> Result<(), String> {
    let (host, pass) = get_auth(engine)?;
    let mysql = mysql_bin(engine, "mysql")?;
    let port = host.split(':').last().unwrap_or("3306");

    let charset = if charset.is_empty() { "utf8mb4" } else { charset };
    let collation = if collation.is_empty() { "utf8mb4_general_ci" } else { collation };

    let sql = format!(
        "CREATE DATABASE `{database}` CHARACTER SET {charset} COLLATE {collation}"
    );

    let mut cmd = Command::new(&mysql);
    cmd.arg("-u").arg("root")
        .arg("-h").arg("127.0.0.1")
        .arg("-P").arg(port)
        .arg("-e").arg(&sql);

    if let Some(ref p) = pass {
        cmd.arg(format!("-p{p}"));
    }

    let output = cmd.output().map_err(|e| format!("执行 CREATE DATABASE 失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("创建数据库失败: {stderr}"));
    }
    Ok(())
}

/// 设置 root 密码
pub fn set_root_password(engine: DbEngine, new_password: &str) -> Result<(), String> {
    let (host, old_pass) = get_auth(engine)?;
    let mysqladmin = mysql_bin(engine, "mysqladmin")?;

    let mut cmd = Command::new(&mysqladmin);
    cmd.arg("-u").arg("root").arg("-h").arg("127.0.0.1");

    if let Some(ref p) = old_pass {
        cmd.arg(format!("-p{p}"));
    }

    let port_str = host.split(':').last().unwrap_or("3306");
    cmd.arg("-P").arg(port_str);
    cmd.arg("password").arg(new_password);

    let output = cmd.output().map_err(|e| format!("执行 mysqladmin 失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("设置密码失败: {stderr}"));
    }

    // 持久化密码
    let mut store = load_store();
    match engine {
        DbEngine::Mysql => {
            if let Some(ref mut m) = store.mysql {
                m.root_password = Some(new_password.to_string());
            }
        }
        DbEngine::MariaDb => {
            if let Some(ref mut m) = store.mariadb {
                m.root_password = Some(new_password.to_string());
            }
        }
    }
    crate::stack::store::save_store(&store)
}

/// 数据库列表
#[derive(Debug, Clone, serde::Serialize)]
pub struct DbInfo {
    pub name: String,
    pub charset: String,
    pub collation: String,
    pub table_count: u32,
}

pub fn list_databases(engine: DbEngine) -> Result<Vec<DbInfo>, String> {
    let (host, pass) = get_auth(engine)?;
    let mysql = mysql_bin(engine, "mysql")?;
    let port = host.split(':').last().unwrap_or("3306");

    let sql = r#"
SELECT
  s.schema_name AS name,
  s.default_character_set_name AS charset,
  s.default_collation_name AS collation,
  COALESCE(t.cnt, 0) AS table_count
FROM information_schema.SCHEMATA s
LEFT JOIN (
  SELECT table_schema, COUNT(*) AS cnt
  FROM information_schema.TABLES
  WHERE table_type = 'BASE TABLE'
  GROUP BY table_schema
) t ON s.schema_name = t.table_schema
WHERE s.schema_name NOT IN ('information_schema','mysql','performance_schema','sys')
ORDER BY s.schema_name
"#;

    let mut cmd = Command::new(&mysql);
    cmd.arg("-u").arg("root")
        .arg("-h").arg("127.0.0.1")
        .arg("-P").arg(port)
        .arg("--batch")
        .arg("--skip-column-names")
        .arg("-e").arg(sql);

    if let Some(ref p) = pass {
        cmd.arg(format!("-p{p}"));
    }

    let output = cmd.output().map_err(|e| format!("查询数据库列表失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("查询失败: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut dbs = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 4 {
            dbs.push(DbInfo {
                name: parts[0].to_string(),
                charset: parts[1].to_string(),
                collation: parts[2].to_string(),
                table_count: parts[3].parse().unwrap_or(0),
            });
        }
    }
    Ok(dbs)
}

/// 导入数据库
pub fn import_database(engine: DbEngine, database: &str, file_path: &str) -> Result<(), String> {
    if !Path::new(file_path).exists() {
        return Err(format!("文件不存在: {file_path}"));
    }

    let (host, pass) = get_auth(engine)?;
    let mysql = mysql_bin(engine, "mysql")?;
    let port = host.split(':').last().unwrap_or("3306");

    let mut cmd = Command::new(&mysql);
    cmd.arg("-u").arg("root")
        .arg("-h").arg("127.0.0.1")
        .arg("-P").arg(port)
        .arg(database);

    if let Some(ref p) = pass {
        cmd.arg(format!("-p{p}"));
    }

    // 读取 SQL 并修正 MySQL 8.0 → MariaDB 不兼容的排序规则
    let sql = std::fs::read_to_string(file_path)
        .map_err(|e| format!("读取导入文件失败: {e}"))?;
    let sql = sql
        .replace("utf8mb4_0900_ai_ci", "utf8mb4_general_ci")
        .replace("utf8mb4_0900_as_ci", "utf8mb4_general_ci")
        .replace("utf8mb4_0900_as_cs", "utf8mb4_general_ci")
        .replace("utf8mb4_0900_bin", "utf8mb4_bin");

    use std::io::Write;
    let mut child = cmd.stdin(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 mysql 失败: {e}"))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin.write_all(sql.as_bytes())
            .map_err(|e| format!("写入导入数据失败: {e}"))?;
    }

    let output = child.wait_with_output().map_err(|e| format!("导入执行失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("导入失败: {stderr}"));
    }
    Ok(())
}

/// 导出数据库（可选表和格式）
pub fn export_database(
    engine: DbEngine,
    database: &str,
    output_path: &str,
    tables: Vec<String>,
    gzip: bool,
) -> Result<(), String> {
    let (host, pass) = get_auth(engine)?;
    let mysqldump = mysql_bin(engine, "mysqldump")?;
    let port = host.split(':').last().unwrap_or("3306");

    let mut cmd = Command::new(&mysqldump);
    cmd.arg("-u").arg("root")
        .arg("-h").arg("127.0.0.1")
        .arg("-P").arg(port)
        .arg("--add-drop-table")
        .arg("--default-character-set=utf8mb4");

    if let Some(ref p) = pass {
        cmd.arg(format!("-p{p}"));
    }

    if gzip {
        cmd.arg("--compress");
    }

    cmd.arg(database);

    for t in &tables {
        cmd.arg(t);
    }

    let output = cmd.output().map_err(|e| format!("执行 mysqldump 失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("导出失败: {stderr}"));
    }

    std::fs::write(output_path, &output.stdout)
        .map_err(|e| format!("写入导出文件失败: {e}"))?;
    Ok(())
}

/// 获取表列表
pub fn list_tables(engine: DbEngine, database: &str) -> Result<Vec<String>, String> {
    let (host, pass) = get_auth(engine)?;
    let mysql = mysql_bin(engine, "mysql")?;
    let port = host.split(':').last().unwrap_or("3306");

    let mut cmd = Command::new(&mysql);
    cmd.arg("-u").arg("root")
        .arg("-h").arg("127.0.0.1")
        .arg("-P").arg(port)
        .arg("--batch")
        .arg("--skip-column-names")
        .arg("-e").arg(format!("SHOW TABLES FROM `{database}`"));

    if let Some(ref p) = pass {
        cmd.arg(format!("-p{p}"));
    }

    let output = cmd.output().map_err(|e| format!("查询表列表失败: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("查询失败: {stderr}"));
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|s| s.to_string())
        .collect())
}
