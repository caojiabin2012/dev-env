import { useCallback, useRef, useState } from 'react';
import type { OcrRegion } from '@/lib/clipboard-api';

interface ImageOcrOverlayProps {
  src: string;
  alt: string;
  regions: OcrRegion[];
  onCopy: (text: string) => void;
}

export function ImageOcrOverlay({ src, alt, regions, onCopy }: ImageOcrOverlayProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragging, setDragging] = useState(false);
  const dragAnchor = useRef<number | null>(null);

  const selectRange = useCallback((from: number, to: number) => {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const next = new Set<number>();
    for (let i = start; i <= end; i++) {
      next.add(i);
    }
    setSelected(next);
  }, []);

  const getSelectedText = useCallback(
    (indices: Set<number>) =>
      [...indices]
        .sort((a, b) => a - b)
        .map((i) => regions[i]?.text ?? '')
        .filter(Boolean)
        .join('\n'),
    [regions],
  );

  const handleRegionMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
      return;
    }
    dragAnchor.current = index;
    setDragging(true);
    selectRange(index, index);
  };

  const handleRegionMouseEnter = (index: number) => {
    if (!dragging || dragAnchor.current === null) return;
    selectRange(dragAnchor.current, index);
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragAnchor.current = null;
  };

  const handleDoubleClick = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = regions[index]?.text;
    if (text) onCopy(text);
  };

  const handleCopySelected = () => {
    const text = getSelectedText(selected);
    if (text) onCopy(text);
  };

  const selectedText = getSelectedText(selected);

  return (
    <div className="w-full space-y-2" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="relative inline-block max-w-full mx-auto select-none">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[55vh] rounded-lg object-contain block"
          draggable={false}
        />
        {regions.map((region, index) => {
          const isSelected = selected.has(index);
          return (
            <button
              key={index}
              type="button"
              className={`absolute rounded-sm border transition-colors cursor-text ${
                isSelected
                  ? 'bg-blue-500/35 border-blue-500'
                  : 'bg-blue-500/10 border-blue-400/40 hover:bg-blue-500/25 hover:border-blue-500/70'
              }`}
              style={{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
              }}
              onMouseDown={(e) => handleRegionMouseDown(index, e)}
              onMouseEnter={() => handleRegionMouseEnter(index)}
              onDoubleClick={(e) => handleDoubleClick(index, e)}
              title={region.text}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>拖动选择文字，双击快速复制，Ctrl+点击多选</span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleCopySelected}
            className="shrink-0 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            复制选中 ({selected.size})
          </button>
        )}
      </div>

      {selectedText && (
        <pre className="p-3 bg-muted rounded-lg text-sm text-foreground font-mono whitespace-pre-wrap break-all overflow-auto max-h-32 select-text">
          {selectedText}
        </pre>
      )}
    </div>
  );
}
