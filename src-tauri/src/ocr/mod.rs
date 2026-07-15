#[cfg(target_os = "macos")]
pub mod macos_ocr;
#[cfg(target_os = "windows")]
pub mod windows_ocr;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrRegion {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub text: String,
    pub regions: Vec<OcrRegion>,
}

pub async fn recognize(image_data: &[u8]) -> Result<OcrResult, String> {
    #[cfg(target_os = "windows")]
    {
        windows_ocr::recognize(image_data).await
    }
    #[cfg(target_os = "macos")]
    {
        macos_ocr::recognize(image_data).await
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("OCR not supported on this platform".to_string())
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::recognize;

    #[tokio::test]
    async fn smoke_test_with_temp_png() {
        let path = std::env::temp_dir().join("ocr_test_text.png");
        if !path.exists() {
            return;
        }
        let bytes = std::fs::read(path).unwrap();
        let result = recognize(&bytes).await.expect("ocr should work");
        assert!(!result.text.is_empty() || !result.regions.is_empty());
    }
}
