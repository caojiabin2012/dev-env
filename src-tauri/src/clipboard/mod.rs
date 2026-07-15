pub mod database;
pub mod commands;
pub mod monitor;
pub mod image_io;

use std::sync::{Arc, Mutex, MutexGuard};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use once_cell::sync::Lazy;

pub static LAST_CLIPBOARD_HASH: Lazy<Arc<Mutex<String>>> = Lazy::new(|| Arc::new(Mutex::new(String::new())));
pub static SKIP_NEXT_IMAGE: AtomicBool = AtomicBool::new(false);

/// Windows 剪贴板 API 非线程安全；串行化所有读写，避免连续复制时多线程并发访问导致进程崩溃。
pub static CLIPBOARD_IO_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

pub fn clipboard_io_lock() -> MutexGuard<'static, ()> {
    CLIPBOARD_IO_LOCK
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

/// 标记应用自身正在写剪贴板，避免监听器与写操作并发访问导致 Windows 崩溃。
pub struct OwnClipboardWriteGuard;

impl OwnClipboardWriteGuard {
    pub fn begin() -> Self {
        SKIP_NEXT_IMAGE.store(true, Ordering::SeqCst);
        Self
    }
}

impl Drop for OwnClipboardWriteGuard {
    fn drop(&mut self) {
        std::thread::spawn(|| {
            std::thread::sleep(Duration::from_millis(300));
            SKIP_NEXT_IMAGE.store(false, Ordering::SeqCst);
        });
    }
}

pub use commands::*;
pub use database::Database;
pub use monitor::ClipboardMonitor;
