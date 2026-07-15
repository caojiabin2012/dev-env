interface FilterBarProps {
  contentType: string;
  timeFilter: string;
  searchQuery: string;
  totalCount: number;
  onContentTypeChange: (type: string) => void;
  onTimeFilterChange: (filter: string) => void;
  onSearchChange: (query: string) => void;
  onClearAll: () => void;
}

const timeFilters = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

const contentTypes = [
  { value: 'all', label: '全部' },
  { value: 'text', label: '文本' },
  { value: 'image', label: '图片' },
  { value: 'file', label: '文件' },
];

export function FilterBar({
  contentType,
  timeFilter,
  searchQuery,
  totalCount,
  onContentTypeChange,
  onTimeFilterChange,
  onSearchChange,
  onClearAll,
}: FilterBarProps) {
  return (
    <div className="border-b border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索剪切板内容..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button
          onClick={onClearAll}
          className="px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          清空
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {timeFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onTimeFilterChange(filter.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                timeFilter === filter.value
                  ? 'bg-blue-500 text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-blue-500'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {contentTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => onContentTypeChange(type.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                contentType === type.value
                  ? 'bg-blue-500 text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-blue-500'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground">
          共 {totalCount} 条
        </span>
      </div>
    </div>
  );
}
