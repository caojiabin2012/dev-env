import { useState, useEffect } from 'react';
import {
  getClipboardItemDetail,
  copyToClipboard,
  copyImageToClipboard,
  openFile,
  openFileContainingFolder,
  // ocrImage,
} from '@/lib/clipboard-api';
import type { ClipboardItemDetail } from '@/lib/clipboard-api';
import { ClipboardImage } from './clipboard-image';
// import { ImageOcrOverlay } from './image-ocr-overlay';

interface ClipboardDetailProps {
  itemId: number | null;
  onClose: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function ClipboardDetail({ itemId, onClose }: ClipboardDetailProps) {
  const [detail, setDetail] = useState<ClipboardItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'image' | 'text' | null>(null);
  // OCR 文字识别与复制功能暂时关闭
  // const [ocrText, setOcrText] = useState<string | null>(null);
  // const [ocrRegions, setOcrRegions] = useState<OcrRegion[]>([]);
  // const [ocrLoading, setOcrLoading] = useState(false);
  // const [ocrError, setOcrError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    getClipboardItemDetail(itemId)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [itemId]);

  /*
  const runOcr = useCallback(async (imageData: number[]) => {
    setOcrLoading(true);
    setOcrError(null);
    setOcrText(null);
    setOcrRegions([]);
    try {
      const result = await ocrImage(imageData);
      const text = result.text.trim();
      if (text || result.regions.length > 0) {
        setOcrText(text);
        setOcrRegions(result.regions);
      } else {
        setOcrError('未识别到文字');
      }
    } catch (e) {
      setOcrError(String(e));
    } finally {
      setOcrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detail || detail.content_type !== 'image' || !detail.content_image?.length) {
      return;
    }
    runOcr(detail.content_image);
  }, [detail, runOcr]);

  const handleCopyOcrText = async (text: string) => {
    if (!text) return;
    await copyToClipboard(text);
    setCopied('ocr');
    setTimeout(() => setCopied(null), 2000);
  };
  */

  const handleCopyText = async () => {
    if (!detail?.content_text) return;
    await copyToClipboard(detail.content_text);
    setCopied('text');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyImage = async () => {
    if (!detail) return;
    try {
      await copyImageToClipboard(detail.id);
      setCopied('image');
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      console.error('Failed to copy image:', e);
    }
  };

  const handleCopyFilePath = async () => {
    if (!detail?.file_path) return;
    await copyToClipboard(detail.file_path);
    setCopied('text');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleOpenFile = async () => {
    if (!detail?.file_path) return;
    await openFile(detail.file_path);
  };

  const handleOpenFolder = async () => {
    if (!detail?.file_path) return;
    await openFileContainingFolder(detail.file_path);
  };

  if (!itemId) return null;

  const isText = detail?.content_type === 'text';
  const isImage = detail?.content_type === 'image';
  const isFile = detail?.content_type === 'file';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`bg-card rounded-xl shadow-xl w-full mx-4 flex flex-col ${
          isImage ? 'max-w-4xl max-h-[90vh]' : 'max-w-2xl max-h-[80vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">
            {isFile ? '文件详情' : isImage ? '图片详情' : '详情'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{new Date(detail.created_at).toLocaleString('zh-CN')}</span>
                <span>•</span>
                <span>{isFile ? '文件' : isImage ? (detail.mime_type === 'image/gif' ? 'GIF 动图' : '图片') : '文本'}</span>
                {detail.is_pinned && <span>• 📌 已置顶</span>}
                {/* OCR 重新识别暂时关闭
                {isImage && detail.content_image && (
                  <>
                    <span>•</span>
                    <button
                      onClick={() => runOcr(detail.content_image!)}
                      disabled={ocrLoading}
                      className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      {ocrLoading ? '识别中...' : '重新识别'}
                    </button>
                  </>
                )}
                */}
              </div>

              {isText ? (
                <pre className="p-4 bg-muted rounded-lg text-sm text-foreground font-mono whitespace-pre-wrap break-all overflow-auto max-h-96">
                  {detail.content_text || '(空)'}
                </pre>
              ) : isImage ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <ClipboardImage
                    itemId={detail.id}
                    className="max-w-full max-h-[80vh] rounded-lg object-contain"
                    alt="Clipboard image"
                  />
                  {/* OCR 文字选区与复制功能暂时关闭
                  {ocrLoading ? (
                    ...
                  ) : ocrError ? (
                    ...
                  ) : imageBase64 && ocrRegions.length > 0 ? (
                    <ImageOcrOverlay ... />
                  ) : ...
                  */}

                  <span className="text-sm text-muted-foreground">
                    {detail.image_width}×{detail.image_height}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                    <span className="text-3xl">📄</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {detail.file_name || '未知文件'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(detail.file_size)}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">文件路径</p>
                    <p className="text-sm text-foreground font-mono break-all">
                      {detail.file_path || '未知路径'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">加载失败</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            关闭
          </button>
          {isText && detail?.content_text && (
            <button
              onClick={handleCopyText}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {copied === 'text' ? '已复制!' : '复制内容'}
            </button>
          )}
          {isImage && detail?.content_image && (
            <button
              onClick={handleCopyImage}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {copied === 'image' ? '已复制!' : '复制图片'}
            </button>
          )}
          {isFile && detail?.file_path && (
            <>
              <button
                onClick={handleCopyFilePath}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {copied === 'text' ? '已复制!' : '复制路径'}
              </button>
              <button
                onClick={handleOpenFile}
                className="px-4 py-2 text-sm border border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                打开文件
              </button>
              <button
                onClick={handleOpenFolder}
                className="px-4 py-2 text-sm border border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                打开所在目录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
