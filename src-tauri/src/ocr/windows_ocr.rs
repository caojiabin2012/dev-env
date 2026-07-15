use super::{OcrRegion, OcrResult};
use std::path::Path;
use std::sync::Once;
use windows::{
    core::{Error, HSTRING, Interface, Result as WinResult},
    Globalization::Language,
    Graphics::Imaging::{
        BitmapBufferAccessMode, BitmapDecoder, BitmapPixelFormat, SoftwareBitmap,
    },
    Media::Ocr::OcrEngine,
    Storage::{FileAccessMode, StorageFile},
    Win32::System::WinRT::{RoInitialize, IMemoryBufferByteAccess, RO_INIT_MULTITHREADED},
};

static WINRT_INIT: Once = Once::new();

pub async fn recognize(image_data: &[u8]) -> Result<OcrResult, String> {
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("ocr_{}.png", std::process::id()));
    std::fs::write(&temp_file, image_data).map_err(|e| e.to_string())?;

    let path = temp_file.clone();
    let bytes = image_data.to_vec();

    let result = tokio::task::spawn_blocking(move || run_ocr(&path, &bytes))
        .await
        .map_err(|e| format!("Task failed: {}", e))?;

    let _ = std::fs::remove_file(&temp_file);
    result
}

fn run_ocr(path: &Path, image_data: &[u8]) -> Result<OcrResult, String> {
    ensure_winrt();

    let bitmap = load_bitmap(path, image_data).map_err(|e| format!("Failed to load image: {e}"))?;
    let bitmap = ensure_supported_format(bitmap)
        .map_err(|e| format!("Failed to convert image format: {e}"))?;

    let engine = create_ocr_engine().map_err(|e| format!("Failed to create OCR engine: {e}"))?;
    let ocr = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| format!("OCR request failed: {e}"))?
        .get()
        .map_err(|e| format!("OCR recognition failed: {e}"))?;

    build_result(ocr, &bitmap)
}

fn ensure_winrt() {
    WINRT_INIT.call_once(|| unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    });
}

fn normalize_path(path: &Path) -> String {
    std::fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .replace("\\\\?\\", "")
}

fn load_bitmap(path: &Path, image_data: &[u8]) -> WinResult<SoftwareBitmap> {
    match load_bitmap_from_file(path) {
        Ok(bitmap) => Ok(bitmap),
        Err(file_err) => {
            log::warn!("StorageFile OCR load failed: {file_err}, falling back to image decode");
            load_bitmap_from_bytes(image_data)
        }
    }
}

fn load_bitmap_from_file(path: &Path) -> WinResult<SoftwareBitmap> {
    let path = normalize_path(path);
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))?.get()?;
    let stream = file.OpenAsync(FileAccessMode::Read)?.get()?;

    let decoder = match BitmapDecoder::CreateAsync(&stream)?.get() {
        Ok(decoder) => decoder,
        Err(_) => BitmapDecoder::CreateWithIdAsync(
            BitmapDecoder::PngDecoderId()?,
            &file.OpenAsync(FileAccessMode::Read)?.get()?,
        )?
        .get()?,
    };

    decoder.GetSoftwareBitmapAsync()?.get()
}

fn load_bitmap_from_bytes(image_data: &[u8]) -> WinResult<SoftwareBitmap> {
    let img = image::load_from_memory(image_data).map_err(|e| {
        Error::new(
            windows::core::HRESULT(0x80004005u32 as i32),
            format!("image decode failed: {e}"),
        )
    })?;
    let width = img.width() as i32;
    let height = img.height() as i32;
    let rgba = img.to_rgba8().into_raw();
    create_rgba_bitmap(width, height, &rgba)
}

fn create_rgba_bitmap(width: i32, height: i32, rgba: &[u8]) -> WinResult<SoftwareBitmap> {
    let bitmap = SoftwareBitmap::Create(BitmapPixelFormat::Rgba8, width, height)?;
    let buffer = bitmap.LockBuffer(BitmapBufferAccessMode::Write)?;
    let reference = buffer.CreateReference()?;
    let byte_access: IMemoryBufferByteAccess = reference.cast()?;

    unsafe {
        let mut data = std::ptr::null_mut();
        let mut capacity = 0u32;
        byte_access.GetBuffer(&mut data, &mut capacity)?;
        let target =
            std::slice::from_raw_parts_mut(data, capacity as usize);
        let len = (width * height * 4) as usize;
        let copy_len = len.min(capacity as usize).min(rgba.len());
        target[..copy_len].copy_from_slice(&rgba[..copy_len]);
    }

    Ok(bitmap)
}

fn ensure_supported_format(bitmap: SoftwareBitmap) -> WinResult<SoftwareBitmap> {
    match bitmap.BitmapPixelFormat()? {
        BitmapPixelFormat::Gray8 | BitmapPixelFormat::Bgra8 | BitmapPixelFormat::Rgba8 => {
            Ok(bitmap)
        }
        _ => SoftwareBitmap::Convert(&bitmap, BitmapPixelFormat::Bgra8),
    }
}

fn create_ocr_engine() -> WinResult<OcrEngine> {
    if let Ok(engine) = OcrEngine::TryCreateFromUserProfileLanguages() {
        return Ok(engine);
    }

    if let Ok(langs) = OcrEngine::AvailableRecognizerLanguages() {
        if let Ok(first) = langs.First() {
            if let Ok(lang) = first.Current() {
                if let Ok(tag) = lang.LanguageTag() {
                    if let Ok(lang) = Language::CreateLanguage(&tag) {
                        if let Ok(engine) = OcrEngine::TryCreateFromLanguage(&lang) {
                            return Ok(engine);
                        }
                    }
                }
            }
        }
    }

    for tag in ["zh-CN", "en-US"] {
        if let Ok(lang) = Language::CreateLanguage(&HSTRING::from(tag)) {
            if let Ok(engine) = OcrEngine::TryCreateFromLanguage(&lang) {
                return Ok(engine);
            }
        }
    }

    Err(Error::new(
        windows::core::HRESULT(0x80004005u32 as i32),
        "No OCR language pack available",
    ))
}

fn build_result(
    ocr: windows::Media::Ocr::OcrResult,
    bitmap: &SoftwareBitmap,
) -> Result<OcrResult, String> {
    let text = ocr
        .Text()
        .map(|s| s.to_string())
        .unwrap_or_default()
        .trim()
        .to_string();

    let bmp_w = bitmap.PixelWidth().map_err(|e| e.to_string())? as f64;
    let bmp_h = bitmap.PixelHeight().map_err(|e| e.to_string())? as f64;
    let mut regions = Vec::new();

    if bmp_w > 0.0 && bmp_h > 0.0 {
        if let Ok(lines) = ocr.Lines() {
            let line_count = lines.Size().unwrap_or(0);
            for i in 0..line_count {
                if let Ok(line) = lines.GetAt(i) {
                    if let Some(region) = line_to_region(&line, bmp_w, bmp_h) {
                        regions.push(region);
                    }
                }
            }
        }
    }

    if text.is_empty() && regions.is_empty() {
        return Err(
            "未识别到文字，请确认系统已安装 OCR 语言包（设置 → 时间和语言 → 语言）".into(),
        );
    }

    Ok(OcrResult {
        text: if text.is_empty() {
            regions
                .iter()
                .map(|r| r.text.as_str())
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            text
        },
        regions,
    })
}

fn line_to_region(
    line: &windows::Media::Ocr::OcrLine,
    bmp_w: f64,
    bmp_h: f64,
) -> Option<OcrRegion> {
    let line_text = line.Text().ok()?.to_string();
    if line_text.trim().is_empty() {
        return None;
    }

    let words = line.Words().ok()?;
    let word_count = words.Size().ok()?;
    if word_count == 0 {
        return None;
    }

    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_right = 0.0_f64;
    let mut max_bottom = 0.0_f64;

    for j in 0..word_count {
        let word = words.GetAt(j).ok()?;
        let rect = word.BoundingRect().ok()?;
        let x = rect.X as f64;
        let y = rect.Y as f64;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_right = max_right.max(x + rect.Width as f64);
        max_bottom = max_bottom.max(y + rect.Height as f64);
    }

    Some(OcrRegion {
        text: line_text,
        x: min_x / bmp_w,
        y: min_y / bmp_h,
        width: (max_right - min_x) / bmp_w,
        height: (max_bottom - min_y) / bmp_h,
    })
}
