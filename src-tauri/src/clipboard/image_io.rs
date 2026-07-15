use std::io::Cursor;
use std::path::{Path, PathBuf};

pub fn is_gif(data: &[u8]) -> bool {
    data.len() >= 6 && &data[0..3] == b"GIF" && (&data[3..6] == b"87a" || &data[3..6] == b"89a")
}

pub fn gif_dimensions(data: &[u8]) -> Option<(i32, i32)> {
    if !is_gif(data) || data.len() < 10 {
        return None;
    }
    let width = i32::from(u16::from_le_bytes([data[6], data[7]]));
    let height = i32::from(u16::from_le_bytes([data[8], data[9]]));
    if width <= 0 || height <= 0 {
        return None;
    }
    Some((width, height))
}

pub fn image_mime_type(data: &[u8], mime_type: Option<&str>) -> &'static str {
    if is_gif(data) {
        return "image/gif";
    }
    if mime_type == Some("image/gif") {
        return "image/gif";
    }
    if mime_type.is_some_and(|m| m.contains("jpeg") || m.contains("jpg")) {
        return "image/jpeg";
    }
    "image/png"
}

/// 从字节块中提取 GIF（支持嵌入在其他容器格式里的 GIF）
pub fn extract_gif_payload(data: &[u8]) -> Option<Vec<u8>> {
    if is_gif(data) {
        return Some(data.to_vec());
    }
    let scan_limit = data.len().min(8 * 1024 * 1024);
    for i in 0..scan_limit.saturating_sub(6) {
        if is_gif(&data[i..]) {
            return Some(data[i..].to_vec());
        }
    }
    None
}

pub fn read_gif_from_path(path: &Path) -> Option<Vec<u8>> {
    let data = std::fs::read(path).ok()?;
    extract_gif_payload(&data)
}

/// 从剪贴板文件列表读取 GIF（复制 .gif 文件时）
pub fn try_read_gif_from_file_list_paths(paths: &[PathBuf]) -> Option<Vec<u8>> {
    for path in paths {
        if let Some(data) = read_gif_from_path(path) {
            log::info!("Read GIF from copied file: {}", path.display());
            return Some(data);
        }
    }
    None
}

#[cfg(target_os = "windows")]
pub fn try_read_gif_from_hdrop() -> Option<Vec<u8>> {
    use clipboard_win::{formats, is_format_avail, raw};

    let _clip = clipboard_win::Clipboard::new_attempts(10).ok()?;
    if !is_format_avail(formats::CF_HDROP) {
        return None;
    }

    let mut paths = Vec::new();
    raw::get_file_list_path(&mut paths).ok()?;
    try_read_gif_from_file_list_paths(&paths)
}

#[cfg(not(target_os = "windows"))]
pub fn try_read_gif_from_hdrop() -> Option<Vec<u8>> {
    None
}

#[cfg(target_os = "windows")]
pub fn clipboard_has_gif_file() -> bool {
    use clipboard_win::{formats, is_format_avail, raw};

    let Ok(_clip) = clipboard_win::Clipboard::new_attempts(10) else {
        return false;
    };
    if !is_format_avail(formats::CF_HDROP) {
        return false;
    }

    let mut paths = Vec::new();
    if raw::get_file_list_path(&mut paths).is_err() {
        return false;
    }

    paths.iter().any(|p| is_gif_path(p))
}

#[cfg(not(target_os = "windows"))]
pub fn clipboard_has_gif_file() -> bool {
    false
}

#[cfg(target_os = "windows")]
pub fn try_read_gif_from_clipboard_formats() -> Option<Vec<u8>> {
    use clipboard_win::{is_format_avail, raw, EnumFormats};

    let _clip = clipboard_win::Clipboard::new_attempts(10).ok()?;

    for name in ["GIF", "gif", "GIF Format"] {
        if let Some(data) = read_format_if_gif(name) {
            log::info!("Read GIF from clipboard format '{name}'");
            return Some(data);
        }
    }

    for format_id in EnumFormats::new() {
        if !is_format_avail(format_id) {
            continue;
        }
        let mut data = Vec::new();
        if raw::get_vec(format_id, &mut data).is_err() {
            continue;
        }
        if let Some(gif) = extract_gif_payload(&data) {
            log::info!("Read embedded GIF from clipboard format id {format_id}");
            return Some(gif);
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
pub fn try_read_gif_from_clipboard_formats() -> Option<Vec<u8>> {
    None
}

#[cfg(target_os = "windows")]
fn read_format_if_gif(name: &str) -> Option<Vec<u8>> {
    use clipboard_win::{is_format_avail, raw, register_format};

    let format = register_format(name)?;
    if !is_format_avail(format.get()) {
        return None;
    }
    let mut data = Vec::new();
    raw::get_vec(format.get(), &mut data).ok()?;
    extract_gif_payload(&data)
}

/// 将 PNG/静态图写入剪贴板（Windows 原生 API，避免 arboard 写时与监听器冲突崩溃）
pub fn set_clipboard_static_image(data: &[u8]) -> Result<(), String> {
    if is_gif(data) {
        return set_clipboard_gif(data);
    }

    #[cfg(target_os = "windows")]
    {
        use clipboard_win::{raw, register_format};
        use crate::clipboard::clipboard_io_lock;

        let _io_guard = clipboard_io_lock();
        let _clip = clipboard_win::Clipboard::new_attempts(10)
            .map_err(|e| format!("Failed to open clipboard: {e:?}"))?;

        raw::empty().map_err(|e| format!("Failed to empty clipboard: {e:?}"))?;

        let png_format =
            register_format("PNG").ok_or("Failed to register PNG clipboard format")?;
        raw::set_without_clear(png_format.get(), data)
            .map_err(|e| format!("Failed to set PNG on clipboard: {e:?}"))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        use crate::clipboard::clipboard_io_lock;

        let _io_guard = clipboard_io_lock();
        let img = image::load_from_memory(data).map_err(|e| e.to_string())?;
        let rgba = img.to_rgba8();
        let (width, height) = rgba.dimensions();
        let bytes = rgba.into_raw();

        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        let img_data = arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(bytes),
        };
        clipboard.set_image(img_data).map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// 将 GIF 写入剪贴板（GIF 格式 + PNG 首帧，便于各应用粘贴）
pub fn set_clipboard_gif(data: &[u8]) -> Result<(), String> {
    if !is_gif(data) {
        return Err("Invalid GIF data".into());
    }

    #[cfg(target_os = "windows")]
    {
        use clipboard_win::{raw, register_format};
        use crate::clipboard::clipboard_io_lock;

        let _io_guard = clipboard_io_lock();
        let _clip = clipboard_win::Clipboard::new_attempts(10)
            .map_err(|e| format!("Failed to open clipboard: {e:?}"))?;

        raw::empty().map_err(|e| format!("Failed to empty clipboard: {e:?}"))?;

        let gif_format = register_format("GIF").ok_or("Failed to register GIF clipboard format")?;
        raw::set_without_clear(gif_format.get(), data)
            .map_err(|e| format!("Failed to set GIF on clipboard: {e:?}"))?;

        if let Ok(img) = image::load_from_memory(data) {
            let mut png_buf = Vec::new();
            if img
                .write_to(&mut Cursor::new(&mut png_buf), image::ImageFormat::Png)
                .is_ok()
            {
                if let Some(png_format) = register_format("PNG") {
                    let _ = raw::set_without_clear(png_format.get(), &png_buf);
                }
            }
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("GIF clipboard write is not supported on this platform".into())
    }
}

pub fn is_gif_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("gif"))
}
