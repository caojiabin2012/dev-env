use super::OcrResult;

pub async fn recognize(image_data: &[u8]) -> Result<OcrResult, String> {
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("ocr_{}.png", std::process::id()));
    std::fs::write(&temp_file, image_data).map_err(|e| e.to_string())?;
    let path_str = temp_file.to_string_lossy().to_string();

    let json = tokio::task::spawn_blocking(move || {
        let swift_code = format!(
            r#"
import Vision
import AppKit
import Foundation

let imagePath = "{path_str}"
guard let image = NSImage(contentsOfFile: imagePath),
      let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let cgImage = bitmap.cgImage(forProposedRect: nil, context: nil, hints: nil) else {{
    print("{{\"text\":\"\",\"regions\":[]}}")
    exit(0)
}}

let semaphore = DispatchSemaphore(value: 0)
var regions: [[String: Any]] = []
var fullText = ""

let request = VNRecognizeTextRequest {{ request, error in
    defer {{ semaphore.signal() }}
    guard let results = request.results as? [VNRecognizedTextObservation] else {{ return }}
    fullText = results.compactMap {{ $0.topCandidates(1).first?.string }}.joined(separator: "\n")
    for observation in results {{
        guard let text = observation.topCandidates(1).first?.string else {{ continue }}
        let box = observation.boundingBox
        regions.append([
            "text": text,
            "x": box.origin.x,
            "y": 1.0 - box.origin.y - box.size.height,
            "width": box.size.width,
            "height": box.size.height,
        ])
    }}
}}

request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US", "en-GB"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])
semaphore.wait()

let output: [String: Any] = ["text": fullText, "regions": regions]
if let data = try? JSONSerialization.data(withJSONObject: output, options: []),
   let json = String(data: data, encoding: .utf8) {{
    print(json)
}} else {{
    print("{{\"text\":\"\",\"regions\":[]}}")
}}
"#
        );

        std::process::Command::new("swift")
            .arg("-")
            .env("PATH", "/usr/bin:/usr/local/bin:/opt/homebrew/bin")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to run Swift: {}", e))
            .and_then(|mut child| {
                use std::io::Write;
                if let Some(ref mut stdin) = child.stdin {
                    stdin.write_all(swift_code.as_bytes()).map_err(|e| e.to_string())?;
                }
                let output = child
                    .wait_with_output()
                    .map_err(|e| format!("Failed to wait: {}", e))?;
                let _ = std::fs::remove_file(&temp_file);
                if output.status.success() {
                    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
                } else {
                    Err(format!(
                        "OCR failed: {}",
                        String::from_utf8_lossy(&output.stderr)
                    ))
                }
            })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))??;

    serde_json::from_str(&json).map_err(|e| format!("Failed to parse OCR result: {}", e))
}
