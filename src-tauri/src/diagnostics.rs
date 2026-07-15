use crate::app_paths;

pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let thread = std::thread::current();
        let thread_name = thread.name().unwrap_or("unknown");
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Box<dyn Any>".to_string()
        };
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_default();
        let backtrace = std::backtrace::Backtrace::force_capture();
        let msg = format!(
            "thread: {thread_name}\nmessage: {payload}\nlocation: {location}\nbacktrace:\n{backtrace}"
        );
        log::error!("PANIC: {msg}");
        app_paths::append_diagnostic("crash.log", "PANIC", &msg);
    }));
}

#[tauri::command]
pub fn record_client_error(kind: String, message: String) -> Result<(), String> {
    let body = format!("[{kind}] {message}");
    log::error!("Frontend error: {body}");
    app_paths::append_diagnostic("crash.log", "FRONTEND", &body);
    Ok(())
}
