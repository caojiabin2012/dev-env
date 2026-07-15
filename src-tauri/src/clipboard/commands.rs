use std::sync::{Arc, Mutex};
use tauri::State;
use sha2::{Sha256, Digest};
use crate::clipboard::database::{Database, ClipboardItemPreview, ClipboardItem};
use crate::clipboard::{clipboard_io_lock, LAST_CLIPBOARD_HASH, OwnClipboardWriteGuard};
use crate::clipboard::image_io::{
    set_clipboard_gif, set_clipboard_static_image, is_gif, image_mime_type,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};

pub struct ClipboardDbState {
    pub db: Arc<Mutex<Database>>,
}

#[derive(Debug, Deserialize)]
pub struct GetItemsParams {
    pub content_type: Option<String>,
    pub search_query: Option<String>,
    pub time_filter: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct GetItemsResult {
    pub items: Vec<ClipboardItemPreview>,
    pub total: i64,
}

#[tauri::command]
pub fn get_clipboard_items(
    state: State<'_, ClipboardDbState>,
    params: GetItemsParams,
) -> Result<GetItemsResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let content_type = params.content_type.as_deref();
    let search_query = params.search_query.as_deref();
    let time_filter = params.time_filter.as_deref();
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);
    let items = db.get_items(content_type, search_query, time_filter, limit, offset)
        .map_err(|e| e.to_string())?;
    let total = db.get_total_count(content_type, search_query, time_filter)
        .map_err(|e| e.to_string())?;
    Ok(GetItemsResult { items, total })
}

#[tauri::command]
pub fn get_clipboard_item_detail(
    state: State<'_, ClipboardDbState>,
    id: i64,
) -> Result<Option<ClipboardItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_item_detail(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_clipboard_item(
    state: State<'_, ClipboardDbState>,
    id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_item(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pin_item(
    state: State<'_, ClipboardDbState>,
    id: i64,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.toggle_pin(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_clipboard_history(
    state: State<'_, ClipboardDbState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.clear_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    let _write_guard = OwnClipboardWriteGuard::begin();
    let _io_guard = clipboard_io_lock();

    // Hash BEFORE writing so monitor won't re-capture
    let hash = hash_bytes(text.as_bytes());
    *LAST_CLIPBOARD_HASH.lock().unwrap() = hash;

    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn paste_from_clipboard() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_clipboard_image_data_url(
    state: State<'_, ClipboardDbState>,
    id: i64,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let detail = db.get_item_detail(id).map_err(|e| e.to_string())?;
    let detail = detail.ok_or("Item not found")?;
    let data = detail.content_image.ok_or("No image data")?;
    let mime = image_mime_type(&data, detail.mime_type.as_deref());
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(&data)))
}

#[tauri::command]
pub fn copy_image_to_clipboard(state: State<'_, ClipboardDbState>, item_id: i64) -> Result<(), String> {
    let _write_guard = OwnClipboardWriteGuard::begin();

    let (image_data, mime_type) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let detail = db.get_item_detail(item_id).map_err(|e| e.to_string())?;
        let detail = detail.ok_or("Item not found")?;
        let image_data = detail.content_image.ok_or("No image data")?;
        let mime_type = detail.mime_type.unwrap_or_else(|| "image/png".to_string());
        (image_data, mime_type)
    };

    if mime_type == "image/gif" || is_gif(&image_data) {
        let hash = hash_bytes(&image_data);
        *LAST_CLIPBOARD_HASH.lock().unwrap() = hash;
        return set_clipboard_gif(&image_data);
    }

    // 监听器通过 arboard 读回 RGBA，hash 需与读回结果一致
    let img = image::load_from_memory(&image_data).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let hash = hash_bytes(rgba.as_raw());
    *LAST_CLIPBOARD_HASH.lock().unwrap() = hash;

    set_clipboard_static_image(&image_data)
}

fn hash_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
pub fn open_file(file_path: String) -> Result<(), String> {
    open::that(&file_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_file_containing_folder(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if let Some(parent) = path.parent() {
        open::that(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ocr_image(image_data: Vec<u8>) -> Result<crate::ocr::OcrResult, String> {
    crate::ocr::recognize(&image_data).await
}
