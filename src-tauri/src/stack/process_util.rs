use std::collections::HashMap;
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::time::Duration;

pub fn run_command(program: &Path, args: &[&str]) -> Result<Output, String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_no_window(&mut cmd);
    cmd.output()
        .map_err(|e| format!("执行 {} 失败: {e}", program.display()))
}

pub fn spawn_detached(program: &Path, args: &[&str]) -> Result<u32, String> {
    spawn_detached_in(program, program.parent(), args)
}

pub fn spawn_detached_in(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
) -> Result<u32, String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    apply_no_window_detached(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("启动 {} 失败: {e}", program.display()))?;
    let pid = child.id();
    std::mem::forget(child);
    Ok(pid)
}

/// Windows 原生服务（MariaDB/MySQL/Nginx 等）用 start /B 脱离父进程 Job，避免被一并杀掉
#[cfg(windows)]
pub fn spawn_windows_background(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let wd = working_dir
        .or_else(|| program.parent())
        .ok_or_else(|| format!("无法确定工作目录: {}", program.display()))?;

    let mut cmd = Command::new("cmd");
    cmd.current_dir(wd);
    cmd.arg("/C").arg("start").arg("/B").arg("");
    cmd.arg(program);
    cmd.args(args);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd
        .status()
        .map_err(|e| format!("启动 {} 失败: {e}", program.display()))?;
    if !status.success() {
        return Err(format!("start 命令未能启动 {}", program.display()));
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn spawn_windows_background(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
) -> Result<(), String> {
    spawn_service_in(program, working_dir, args).map(|_| ())
}

#[cfg(windows)]
pub fn spawn_windows_background_with_env(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
    env: &[(&str, String)],
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let wd = working_dir
        .or_else(|| program.parent())
        .ok_or_else(|| format!("无法确定工作目录: {}", program.display()))?;

    let mut cmd = Command::new("cmd");
    cmd.current_dir(wd);
    for (k, v) in env {
        cmd.env(k, v);
    }
    cmd.arg("/C").arg("start").arg("/B").arg("");
    cmd.arg(program);
    cmd.args(args);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd
        .status()
        .map_err(|e| format!("启动 {} 失败: {e}", program.display()))?;
    if !status.success() {
        return Err(format!("start 命令未能启动 {}", program.display()));
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn spawn_windows_background_with_env(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
    env: &[(&str, String)],
) -> Result<(), String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    for (k, v) in env {
        cmd.env(k, v);
    }
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    apply_no_window(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("启动 {} 失败: {e}", program.display()))?;
    std::mem::forget(child);
    Ok(())
}

/// 后台服务进程：不用 DETACHED_PROCESS，避免 msys2 程序异常退出
pub fn spawn_service_in(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
) -> Result<u32, String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    apply_no_window(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("启动 {} 失败: {e}", program.display()))?;
    let pid = child.id();
    std::mem::forget(child);
    Ok(pid)
}

pub fn run_command_in(
    program: &Path,
    working_dir: Option<&Path>,
    args: &[&str],
) -> Result<Output, String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    apply_no_window(&mut cmd);
    cmd.output()
        .map_err(|e| format!("执行 {} 失败: {e}", program.display()))
}

pub fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    let mut snapshot = PortSnapshot::capture();
    let mut ticks = 0u32;
    while std::time::Instant::now() < deadline {
        if snapshot.is_listening(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
        ticks += 1;
        // 避免每 200ms 都 spawn netstat，降低 Windows 上 UI 卡顿
        if ticks % 4 == 0 {
            snapshot = PortSnapshot::capture();
        }
    }
    snapshot.is_listening(port)
}

pub fn wait_for_port_release(port: u16, timeout: Duration) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    while std::time::Instant::now() < deadline {
        if !is_port_listening(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}

pub fn path_forward(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn tail_file(path: &Path, max_bytes: u64) -> Option<String> {
    use std::io::{Read, Seek, SeekFrom};
    let mut file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).ok()?;
    Some(buf)
}

fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn apply_no_window_detached(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
    }
}

pub fn is_port_listening(port: u16) -> bool {
    PortSnapshot::capture().is_listening(port)
}

/// 一次 netstat 解析所有监听端口，避免状态轮询时重复 spawn 子进程。
pub struct PortSnapshot {
    by_port: HashMap<u16, u32>,
}

impl PortSnapshot {
    pub fn capture() -> Self {
        Self {
            by_port: parse_netstat_listeners(),
        }
    }

    pub fn is_listening(&self, port: u16) -> bool {
        if self.by_port.contains_key(&port) {
            return true;
        }
        let Ok(addr) = format!("127.0.0.1:{port}").parse::<SocketAddr>() else {
            return false;
        };
        TcpStream::connect_timeout(&addr, Duration::from_millis(80)).is_ok()
    }

    pub fn is_listening_netstat(&self, port: u16) -> bool {
        self.by_port.contains_key(&port)
    }

    pub fn pid_on_port(&self, port: u16) -> Option<u32> {
        self.by_port.get(&port).copied()
    }
}

fn parse_netstat_listeners() -> HashMap<u16, u32> {
    #[cfg(windows)]
    {
        let output = match Command::new("netstat")
            .args(["-ano", "-p", "TCP"])
            .output()
        {
            Ok(o) => o,
            Err(_) => return HashMap::new(),
        };
        let text = String::from_utf8_lossy(&output.stdout);
        let mut map = HashMap::new();
        for line in text.lines() {
            if !line.contains("LISTENING") {
                continue;
            }
            let mut parts = line.split_whitespace();
            let Some(local) = parts.nth(1) else {
                continue;
            };
            let Some(port_str) = local.rsplit(':').next() else {
                continue;
            };
            let Ok(port) = port_str.parse::<u16>() else {
                continue;
            };
            if let Some(pid) = parts.last().and_then(|p| p.parse().ok()) {
                map.insert(port, pid);
            }
        }
        map
    }
    #[cfg(not(windows))]
    {
        HashMap::new()
    }
}

pub fn is_port_listening_with_snapshot(port: u16, snapshot: &PortSnapshot) -> bool {
    snapshot.is_listening(port)
}

/// 启动前检查端口：空闲可启动；已是本服务占用则返回其 PID；被其他进程占用则报错。
pub fn check_port_before_start(
    port: u16,
    known_pid: Option<u32>,
    service_label: &str,
) -> Result<Option<u32>, String> {
    check_port_before_start_with_process(port, known_pid, service_label, None)
}

/// `expected_process` 为可执行文件名（如 `mariadbd.exe`），用于未记录 PID 时识别是否已是本服务。
pub fn check_port_before_start_with_process(
    port: u16,
    known_pid: Option<u32>,
    service_label: &str,
    expected_process: Option<&str>,
) -> Result<Option<u32>, String> {
    if !is_port_listening(port) {
        return Ok(None);
    }

    let listener_pid = find_pid_by_port(port);

    if let Some(lpid) = listener_pid {
        if known_pid == Some(lpid) {
            return Ok(Some(lpid));
        }
        if known_pid.is_none() {
            if let Some(expected) = expected_process {
                if process_matches(lpid, expected) {
                    return Ok(Some(lpid));
                }
            }
        }
        return Err(format!(
            "端口 {port} 已被占用（进程 PID: {lpid}），请先停止占用程序后再启动 {service_label}"
        ));
    }

    Err(format!(
        "端口 {port} 已被占用，请先停止占用程序后再启动 {service_label}"
    ))
}

#[cfg(windows)]
fn process_matches(pid: u32, expected_exe: &str) -> bool {
    let output = match Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
        .output()
    {
        Ok(o) => o,
        Err(_) => return false,
    };
    let line = String::from_utf8_lossy(&output.stdout);
    let first = match line.lines().next() {
        Some(l) if !l.contains("No tasks") => l.trim(),
        _ => return false,
    };
    first
        .split(',')
        .next()
        .map(|s| s.trim_matches('"').eq_ignore_ascii_case(expected_exe))
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn process_matches(_pid: u32, _expected_exe: &str) -> bool {
    false
}

pub fn find_pid_by_port(port: u16) -> Option<u32> {
    PortSnapshot::capture().pid_on_port(port)
}

pub fn kill_pid(pid: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        let output = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!(
                "停止进程失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn is_pid_running(pid: u32) -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Threading::{
            GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
        };
        unsafe {
            let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
                return false;
            };
            let mut code = 0u32;
            if GetExitCodeProcess(handle, &mut code).is_err() {
                let _ = CloseHandle(handle);
                return false;
            }
            let _ = CloseHandle(handle);
            code == 259
        }
    }
    #[cfg(not(windows))]
    {
        Path::new(&format!("/proc/{pid}")).exists()
    }
}

pub fn service_status(port: u16, pid: Option<u32>) -> crate::stack::types::ServiceStatus {
    service_status_with_snapshot(&PortSnapshot::capture(), port, pid)
}

pub fn service_status_with_snapshot(
    snapshot: &PortSnapshot,
    port: u16,
    pid: Option<u32>,
) -> crate::stack::types::ServiceStatus {
    if pid.filter(|p| is_pid_running(*p)).is_some() {
        return crate::stack::types::ServiceStatus::Running;
    }
    if snapshot.is_listening_netstat(port) {
        crate::stack::types::ServiceStatus::Running
    } else {
        crate::stack::types::ServiceStatus::Stopped
    }
}
