import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getClipboardItems,
  deleteClipboardItem,
  togglePinItem,
  clearClipboardHistory,
  copyToClipboard,
  copyImageToClipboard,
} from '@/lib/clipboard-api';
import type { ClipboardItemPreview } from '@/lib/clipboard-api';
import { ConfirmDialog } from '@/components/stack/ui';
import { FilterBar } from './filter-bar';
import { ClipboardItemComponent } from './clipboard-item';
import { ClipboardDetail } from './clipboard-detail';

interface ClipboardManagerProps {
  onFormatJson: (text: string) => void;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function ClipboardManager({ onFormatJson }: ClipboardManagerProps) {
  const [items, setItems] = useState<ClipboardItemPreview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [contentType, setContentType] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onOk: () => void } | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getClipboardItems({
        content_type: contentType,
        search_query: searchQuery,
        time_filter: timeFilter,
        limit: 100,
        offset: 0,
      });
      setItems(result.items);
      setTotalCount(result.total);
    } catch (error) {
      console.error('Failed to fetch clipboard items:', error);
    } finally {
      setLoading(false);
    }
  }, [contentType, timeFilter, searchQuery]);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 2000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const handleCopy = useCallback(async (id: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      if (item.content_type === 'text' && item.content_text) {
        await copyToClipboard(item.content_text);
      } else if (item.content_type === 'image') {
        await copyImageToClipboard(id);
      } else if (item.content_type === 'file' && item.file_path) {
        await copyToClipboard(item.file_path);
      } else {
        return;
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (error) {
      console.error('Failed to copy item:', error);
    }
  }, [items]);

  const handleItemClick = useCallback((id: number) => {
    setSelectedId(id);
    handleCopy(id);
  }, [handleCopy]);

  const handlePreview = useCallback((id: number) => {
    setSelectedId(id);
    setDetailId(id);
  }, []);

  const handlePin = useCallback(async (id: number) => {
    try {
      await togglePinItem(id);
      fetchItems();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  }, [fetchItems]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteClipboardItem(id);
      if (selectedId === id) setSelectedId(null);
      if (detailId === id) setDetailId(null);
      fetchItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }, [fetchItems, selectedId, detailId]);

  const handleClearAll = useCallback(() => {
    setConfirm({
      title: '清空历史记录',
      message: '确定要清空非置顶的历史记录吗？',
      danger: true,
      onOk: async () => {
        try {
          await clearClipboardHistory();
          fetchItems();
        } catch (error) {
          console.error('Failed to clear history:', error);
        }
      },
    })
  }, [fetchItems]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isEditableElement(e.target)) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedId((prev) => {
        const currentIndex = items.findIndex((i) => i.id === prev);
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        return items[nextIndex]?.id ?? null;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedId((prev) => {
        const currentIndex = items.findIndex((i) => i.id === prev);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        return items[prevIndex]?.id ?? null;
      });
    } else if (e.key === 'Enter' && selectedId) {
      e.preventDefault();
      handleCopy(selectedId);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      e.preventDefault();
      handleDelete(selectedId);
    } else if (e.key === 'Escape') {
      setSelectedId(null);
      setDetailId(null);
    } else if (e.ctrlKey && e.key === 'p' && selectedId) {
      e.preventDefault();
      handlePin(selectedId);
    }
  }, [items, selectedId, handleCopy, handleDelete, handlePin]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (selectedId && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-id="${selectedId}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedId]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-xl font-semibold text-foreground">剪切板历史</h2>
        <p className="text-sm text-muted-foreground mt-1">
          快捷键: ↑↓ 导航 | Enter 复制 | Delete 删除 | Ctrl+P 置顶 | 点击复制，点击图片预览
        </p>
      </div>

      <FilterBar
        contentType={contentType}
        timeFilter={timeFilter}
        searchQuery={searchQuery}
        totalCount={totalCount}
        onContentTypeChange={setContentType}
        onTimeFilterChange={setTimeFilter}
        onSearchChange={setSearchQuery}
        onClearAll={handleClearAll}
      />

      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-1">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">📋</span>
            <p>暂无剪切板记录</p>
            <p className="text-xs mt-1">复制的内容会自动保存到这里</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} data-id={item.id}>
              <ClipboardItemComponent
                item={item}
                isSelected={selectedId === item.id}
                isCopied={copiedId === item.id}
                onItemClick={handleItemClick}
                onPreview={handlePreview}
                onCopy={handleCopy}
                onPin={handlePin}
                onDelete={handleDelete}
                onFormatJson={onFormatJson}
              />
            </div>
          ))
        )}
      </div>

      <ClipboardDetail
        itemId={detailId}
        onClose={() => setDetailId(null)}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger={confirm?.danger}
        onConfirm={() => {
          confirm?.onOk()
          setConfirm(null)
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
