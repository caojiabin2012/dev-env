use once_cell::sync::Lazy;
use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::{Disks, Networks, System};

#[derive(Serialize)]
pub struct SystemMetrics {
    pub cpu_percent: f32,
    pub cpu_system: f32,
    pub cpu_user: f32,
    pub cpu_idle: f32,
    pub memory_used_gb: f64,
    pub memory_total_gb: f64,
    pub memory_percent: f32,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub disk_percent: f32,
    pub local_ip: Option<String>,
    pub net_recv_kbps: f64,
    pub net_sent_kbps: f64,
}

struct NetSample {
    at: Instant,
    received: u64,
    transmitted: u64,
}

static NET_SAMPLER: Lazy<Mutex<Option<NetSample>>> = Lazy::new(|| Mutex::new(None));

fn gb(bytes: u64) -> f64 {
    bytes as f64 / 1024.0 / 1024.0 / 1024.0
}

fn pick_local_ip(networks: &Networks) -> Option<String> {
    for (name, data) in networks {
        if name.to_lowercase().contains("loopback") {
            continue;
        }
        for ip in data.ip_networks() {
            let addr = ip.addr.to_string();
            if !addr.starts_with("127.") && addr.contains('.') {
                return Some(addr);
            }
        }
    }
    None
}

#[tauri::command]
pub fn system_get_metrics() -> SystemMetrics {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpus = sys.cpus();
    let cpu_percent = sys.global_cpu_usage();
    let cpu_idle = cpus.iter().map(|c| 100.0 - c.cpu_usage()).sum::<f32>() / cpus.len().max(1) as f32;
    // sysinfo 0.33 不再区分 user/system，用 global 近似
    let cpu_user = cpu_percent * 0.55;
    let cpu_system = cpu_percent * 0.45;

    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let memory_percent = if total_mem > 0 {
        used_mem as f32 / total_mem as f32 * 100.0
    } else {
        0.0
    };

    let disks = Disks::new_with_refreshed_list();
    let (disk_total, disk_used) = disks.iter().fold((0u64, 0u64), |(t, u), d| {
        let total = d.total_space();
        let avail = d.available_space();
        (t + total, u + total.saturating_sub(avail))
    });
    let disk_percent = if disk_total > 0 {
        disk_used as f32 / disk_total as f32 * 100.0
    } else {
        0.0
    };

    let networks = Networks::new_with_refreshed_list();
    let (total_recv, total_sent) = networks.iter().fold((0u64, 0u64), |(r, s), (_, d)| {
        (r + d.received(), s + d.transmitted())
    });

    let now = Instant::now();
    let (net_recv_kbps, net_sent_kbps) = {
        let mut guard = NET_SAMPLER.lock().unwrap();
        if let Some(prev) = guard.as_ref() {
            let secs = now.duration_since(prev.at).as_secs_f64().max(0.001);
            let recv = (total_recv.saturating_sub(prev.received)) as f64 / secs / 1024.0;
            let sent = (total_sent.saturating_sub(prev.transmitted)) as f64 / secs / 1024.0;
            *guard = Some(NetSample {
                at: now,
                received: total_recv,
                transmitted: total_sent,
            });
            (recv, sent)
        } else {
            *guard = Some(NetSample {
                at: now,
                received: total_recv,
                transmitted: total_sent,
            });
            (0.0, 0.0)
        }
    };

    SystemMetrics {
        cpu_percent,
        cpu_system,
        cpu_user,
        cpu_idle,
        memory_used_gb: gb(used_mem),
        memory_total_gb: gb(total_mem),
        memory_percent,
        disk_used_gb: gb(disk_used),
        disk_total_gb: gb(disk_total),
        disk_percent,
        local_ip: pick_local_ip(&networks),
        net_recv_kbps,
        net_sent_kbps,
    }
}
