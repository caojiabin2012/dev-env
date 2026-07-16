use tauri::WebviewWindow;

#[cfg(windows)]
fn rgb_to_colorref(hex: u32) -> u32 {
    let r = (hex >> 16) & 0xFF;
    let g = (hex >> 8) & 0xFF;
    let b = hex & 0xFF;
    r | (g << 8) | (b << 16)
}

#[cfg(windows)]
pub fn apply(window: &WebviewWindow, dark: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
        DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWINDOWATTRIBUTE,
    };

    let hwnd: HWND = match window.hwnd() {
        Ok(h) => h,
        Err(e) => {
            log::warn!("Failed to get HWND for title bar styling: {e}");
            return;
        }
    };

    let (caption, text, border) = if dark {
        (0x1E1E1E_u32, 0xFAFAFA_u32, 0x404040_u32)
    } else {
        (0xF2F2F2_u32, 0x0A0A0A_u32, 0xE0E0E0_u32)
    };

    unsafe {
        let dark_mode: i32 = if dark { 1 } else { 0 };
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &dark_mode as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );

        let set_color = |attr: DWMWINDOWATTRIBUTE, color: u32| {
            let colorref = rgb_to_colorref(color);
            let _ = DwmSetWindowAttribute(
                hwnd,
                attr,
                &colorref as *const _ as *const _,
                std::mem::size_of::<u32>() as u32,
            );
        };

        set_color(DWMWA_CAPTION_COLOR, caption);
        set_color(DWMWA_TEXT_COLOR, text);
        set_color(DWMWA_BORDER_COLOR, border);
    }
}

#[cfg(not(windows))]
pub fn apply(_window: &WebviewWindow, _dark: bool) {}

#[tauri::command]
pub fn sync_window_theme(window: WebviewWindow, dark: bool) {
    apply(&window, dark);
}
