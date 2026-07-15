use std::fs;
use std::path::{Path, PathBuf};

const MARKER_PREFIX: &str = "# dev-env:";

pub fn hosts_path() -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
    }
    #[cfg(not(windows))]
    {
        PathBuf::from("/etc/hosts")
    }
}

pub fn is_local_hostname(hostname: &str) -> bool {
    matches!(
        hostname.trim().to_ascii_lowercase().as_str(),
        "localhost" | "127.0.0.1" | "::1"
    )
}

/// 将本地域名写入 hosts（127.0.0.1）。localhost 等内置域名会跳过。
pub fn ensure_entry(hostname: &str, site_id: &str) -> Result<(), String> {
    let hostname = hostname.trim();
    if hostname.is_empty() || is_local_hostname(hostname) {
        return Ok(());
    }

    let path = hosts_path();
    let content = read_hosts(&path)?;
    if hosts_has_entry(&content, hostname) {
        return Ok(());
    }

    let line = format!("127.0.0.1    {hostname}    {MARKER_PREFIX}{site_id}");
    append_line(&path, &content, &line)
}

/// 删除本应用写入的 hosts 记录（按 site_id 标记）。
pub fn remove_entry(hostname: &str, site_id: &str) -> Result<(), String> {
    if is_local_hostname(hostname) {
        return Ok(());
    }

    let path = hosts_path();
    let content = read_hosts(&path)?;
    let marker = format!("{MARKER_PREFIX}{site_id}");
    let mut changed = false;
    let kept: Vec<&str> = content
        .lines()
        .filter(|line| {
            if line.contains(&marker) {
                changed = true;
                false
            } else {
                true
            }
        })
        .collect();

    if !changed {
        return Ok(());
    }

    let mut next = kept.join("\n");
    if !next.ends_with('\n') {
        next.push('\n');
    }
    write_hosts(&path, &next)
}

fn read_hosts(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format_hosts_error("读取", path, &e))
}

fn append_line(path: &Path, existing: &str, line: &str) -> Result<(), String> {
    let mut next = existing.to_string();
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(line);
    next.push('\n');
    write_hosts(path, &next)
}

fn write_hosts(path: &Path, content: &str) -> Result<(), String> {
    match fs::write(path, content) {
        Ok(()) => Ok(()),
        Err(err) if is_permission_denied(&err) => write_hosts_elevated(path, content),
        Err(err) => Err(format_hosts_error("写入", path, &err)),
    }
}

fn hosts_has_entry(content: &str, hostname: &str) -> bool {
    for line in content.lines() {
        let chunk = line.split('#').next().unwrap_or("").trim();
        if chunk.is_empty() {
            continue;
        }
        let mut parts = chunk.split_whitespace();
        let Some(ip) = parts.next() else {
            continue;
        };
        if ip != "127.0.0.1" && ip != "::1" {
            continue;
        }
        for host in parts {
            if host.eq_ignore_ascii_case(hostname) {
                return true;
            }
        }
    }
    false
}

fn is_permission_denied(err: &std::io::Error) -> bool {
    err.kind() == std::io::ErrorKind::PermissionDenied || err.raw_os_error() == Some(5)
}

fn format_hosts_error(action: &str, path: &Path, err: &std::io::Error) -> String {
    format!(
        "{action} hosts 文件失败（{}）：{err}。修改 hosts 通常需要管理员权限。",
        path.display()
    )
}

#[cfg(windows)]
fn write_hosts_elevated(path: &Path, content: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp = std::env::temp_dir().join(format!("dev-env-hosts-{stamp}.tmp"));
    let script = std::env::temp_dir().join(format!("dev-env-hosts-{stamp}.ps1"));
    fs::write(&temp, content).map_err(|e| format!("写入临时 hosts 文件失败: {e}"))?;

    let script_body = format!(
        "$ErrorActionPreference = 'Stop'\nCopy-Item -LiteralPath '{}' -Destination '{}' -Force\n",
        temp.to_string_lossy().replace('\'', "''"),
        path.to_string_lossy().replace('\'', "''")
    );
    fs::write(&script, script_body).map_err(|e| format!("写入提权脚本失败: {e}"))?;

    let script_arg = script.to_string_lossy().replace('\'', "''");
    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!(
                "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','{script_arg}'"
            ),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("请求管理员权限失败: {e}"))?;

    let _ = fs::remove_file(&temp);
    let _ = fs::remove_file(&script);

    if !status.success() {
        return Err(
            "写入 hosts 需要管理员权限，请在 UAC 提示中点击「是」，或手动编辑 hosts 文件。".into(),
        );
    }

    Ok(())
}

#[cfg(not(windows))]
fn write_hosts_elevated(_path: &Path, _content: &str) -> Result<(), String> {
    Err("写入 hosts 需要管理员权限，请手动编辑 /etc/hosts。".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_existing_hosts_entry() {
        let content = "127.0.0.1 localhost\n127.0.0.1 myapp.local # dev-env:myapp\n";
        assert!(hosts_has_entry(content, "myapp.local"));
        assert!(hosts_has_entry(content, "MYAPP.LOCAL"));
        assert!(!hosts_has_entry(content, "other.local"));
    }

    #[test]
    fn skips_local_hostnames() {
        assert!(is_local_hostname("localhost"));
        assert!(is_local_hostname("127.0.0.1"));
        assert!(!is_local_hostname("demo.local"));
    }
}
