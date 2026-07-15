import { invoke } from '@tauri-apps/api/core';

export interface ClipboardItemPreview {
  id: number;
  content_type: string;
  content_text: string | null;
  has_image: boolean;
  image_width: number | null;
  image_height: number | null;
  mime_type: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  is_pinned: boolean;
  created_at: string;
}

export interface ClipboardItemDetail {
  id: number;
  content_type: string;
  content_text: string | null;
  content_image: number[] | null;
  image_width: number | null;
  image_height: number | null;
  mime_type: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  is_pinned: boolean;
  created_at: string;
}

export interface GetItemsParams {
  content_type?: string;
  search_query?: string;
  time_filter?: string;
  limit?: number;
  offset?: number;
}

export interface GetItemsResult {
  items: ClipboardItemPreview[];
  total: number;
}

export async function getClipboardItems(params: GetItemsParams = {}): Promise<GetItemsResult> {
  return invoke('get_clipboard_items', { params });
}

export async function getClipboardItemDetail(id: number): Promise<ClipboardItemDetail | null> {
  return invoke('get_clipboard_item_detail', { id });
}

export async function getClipboardImageDataUrl(id: number): Promise<string> {
  return invoke('get_clipboard_image_data_url', { id });
}

export async function deleteClipboardItem(id: number): Promise<void> {
  return invoke('delete_clipboard_item', { id });
}

export async function togglePinItem(id: number): Promise<boolean> {
  return invoke('toggle_pin_item', { id });
}

export async function clearClipboardHistory(): Promise<void> {
  return invoke('clear_clipboard_history');
}

export async function copyToClipboard(text: string): Promise<void> {
  return invoke('copy_to_clipboard', { text });
}

export async function pasteFromClipboard(): Promise<string> {
  return invoke('paste_from_clipboard');
}

export async function copyImageToClipboard(itemId: number): Promise<void> {
  return invoke('copy_image_to_clipboard', { itemId });
}

export async function openFile(filePath: string): Promise<void> {
  return invoke('open_file', { filePath });
}

export async function openFileContainingFolder(filePath: string): Promise<void> {
  return invoke('open_file_containing_folder', { filePath });
}

export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResult {
  text: string;
  regions: OcrRegion[];
}

export async function ocrImage(imageData: number[]): Promise<OcrResult> {
  return invoke('ocr_image', { imageData });
}

/** 根据文件头识别图片 MIME */
export function detectImageMimeType(bytes: number[] | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (
    data.length >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  ) {
    return 'image/gif'
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png'
  }
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xd8) {
    return 'image/jpeg'
  }
  return 'image/png'
}

/** 将图片字节转为 Blob URL，比 base64 更高效且无损 */
export function createImageObjectUrl(
  bytes: number[] | Uint8Array,
  mimeType?: string | null,
): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const detected = detectImageMimeType(data)
  const type = detected === 'image/gif' ? 'image/gif' : (mimeType || detected)
  const copy = Uint8Array.from(data)
  return URL.createObjectURL(new Blob([copy], { type }))
}

export function revokeImageObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
