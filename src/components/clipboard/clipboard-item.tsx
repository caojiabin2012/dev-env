import { useState } from 'react';
import type { ClipboardItemPreview } from '@/lib/clipboard-api';
import { ClipboardImage } from './clipboard-image';
import { detectJsonText } from '@/lib/json-detect';

interface ClipboardItemProps {
  item: ClipboardItemPreview;
  isSelected: boolean;
  isCopied?: boolean;
  onItemClick: (id: number) => void;
  onPreview: (id: number) => void;
  onCopy: (id: number) => void;
  onPin: (id: number) => void;
  onDelete: (id: number) => void;
  onFormatJson?: (text: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileIcon(fileName: string | null): string {
  if (!fileName) return '📄';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    pdf: '📕',
    doc: '📘', docx: '📘',
    xls: '📗', xlsx: '📗', csv: '📗',
    ppt: '📙', pptx: '📙',
    zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
    mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬', wmv: '🎬',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', svg: '🖼️', webp: '🖼️',
    exe: '⚙️', msi: '⚙️',
    js: '📜', ts: '📜', py: '📜', rs: '📜', go: '📜', java: '📜', cpp: '📜', c: '📜',
    html: '🌐', css: '🌐', json: '📋', xml: '📋', yaml: '📋', yml: '📋',
    txt: '📝', md: '📝', log: '📝',
    ttf: '🔤', otf: '🔧', woff: '🔤',
  };
  return iconMap[ext] || '📄';
}

export function ClipboardItemComponent({
  item,
  isSelected,
  isCopied = false,
  onItemClick,
  onPreview,
  onCopy,
  onPin,
  onDelete,
  onFormatJson,
}: ClipboardItemProps) {
  const [localCopied, setLocalCopied] = useState(false);
  const showCopied = isCopied || localCopied;
  const isText = item.content_type === 'text';
  const isImage = item.content_type === 'image';
  const isFile = item.content_type === 'file';
  const jsonInfo = isText ? detectJsonText(item.content_text) : null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(item.id);
    setLocalCopied(true);
    setTimeout(() => setLocalCopied(false), 1500);
  };

  const typeLabel = isText ? '文本' : isImage ? '图片' : '文件';
  const typeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

  return (
    <div
      onClick={() => onItemClick(item.id)}
      className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-500/10 ring-2 ring-blue-500'
          : 'hover:bg-accent/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {formatTime(item.created_at)}
            </span>
            {item.is_pinned && (
              <span className="text-xs text-yellow-500">📌</span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded ${typeColor}`}>
              {jsonInfo ? 'JSON' : item.mime_type === 'image/gif' ? 'GIF' : typeLabel}
            </span>
            {jsonInfo?.isStringWrapped && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                字符串
              </span>
            )}
          </div>
          
          {isText ? (
            <p className={`text-sm text-foreground break-all line-clamp-2 ${jsonInfo ? 'font-mono' : ''}`}>
              {item.content_text
                ? jsonInfo
                  ? truncateText(
                      JSON.stringify(JSON.parse(jsonInfo.formatterInput)),
                      120,
                    )
                  : truncateText(item.content_text)
                : '(空)'}
            </p>
          ) : isImage ? (
            <div
              className="flex items-center gap-2 cursor-zoom-in"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(item.id);
              }}
              title="点击预览"
            >
              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden ring-1 ring-border hover:ring-blue-500 transition-all">
                {item.has_image ? (
                  <ClipboardImage itemId={item.id} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🖼️</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {item.image_width}×{item.image_height}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                <span className="text-xl">{getFileIcon(item.file_name)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">
                  {item.file_name || '未知文件'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file_size)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {jsonInfo && onFormatJson && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFormatJson(jsonInfo.formatterInput);
              }}
              className="p-1.5 rounded hover:bg-background text-blue-500 hover:text-blue-600"
              title="用 JSON 打开"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
          )}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded transition-colors ${
              showCopied
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'hover:bg-background text-muted-foreground hover:text-blue-500'
            }`}
            title={isFile ? '复制文件路径' : isImage ? '复制图片' : '复制文本'}
          >
            {showCopied ? (
              <span className="text-xs font-medium px-0.5">已复制</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(item.id); }}
            className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
            title={item.is_pinned ? '取消置顶' : '置顶'}
          >
            <span className="text-sm">{item.is_pinned ? '📌' : '📍'}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="删除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
