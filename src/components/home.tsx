import { useMemo, useState } from 'react'
import type { ToolId } from '@/App'

interface ToolGroup {
  name: string
  tools: { id: ToolId; name: string; icon: string }[]
}

interface HomeProps {
  toolGroups: ToolGroup[]
  onSelect: (id: ToolId) => void
}

interface ToolEntry {
  id: ToolId
  name: string
  icon: string
  group: string
  hint: string
}

const FEATURED_IDS: ToolId[] = ['clipboard', 'json-formatter', 'calculator', 'dev-tool']

const TOOL_HINTS: Partial<Record<ToolId, string>> = {
  'json-formatter': '美化 · 压缩 · 树形预览',
  clipboard: '历史记录 · 快速粘贴',
  calculator: '计算 · 单位换算',
  calendar: '公历 · 农历 · 节假日',
  encoding: 'Base64 · URL · 时间戳',
  generator: 'UUID · 密码 · Hash',
  'id-card': '解析 · 校验 · 生成',
  'dev-tool': '正则 · Cron',
  stack: 'MySQL · Nginx · PHP · Redis',
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function ToolTile({
  tool,
  onSelect,
  size = 'normal',
}: {
  tool: ToolEntry
  onSelect: (id: ToolId) => void
  size?: 'normal' | 'large'
}) {
  const isLarge = size === 'large'

  return (
    <button
      type="button"
      onClick={() => onSelect(tool.id)}
      className={`group flex flex-col items-center justify-center text-center rounded-2xl border border-border bg-card transition-all hover:border-foreground/20 hover:bg-accent/40 hover:shadow-sm active:scale-[0.98] ${
        isLarge ? 'gap-3 p-6 min-h-[132px]' : 'gap-2 p-4 min-h-[108px]'
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-xl bg-secondary transition-colors group-hover:bg-background ${
          isLarge ? 'w-14 h-14 text-3xl' : 'w-11 h-11 text-2xl'
        }`}
      >
        {tool.icon}
      </span>
      <div className="min-w-0 w-full px-1">
        <div className={`font-medium text-foreground truncate ${isLarge ? 'text-sm' : 'text-xs'}`}>
          {tool.name}
        </div>
        {tool.hint && (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">{tool.hint}</div>
        )}
      </div>
    </button>
  )
}

export function Home({ toolGroups, onSelect }: HomeProps) {
  const [query, setQuery] = useState('')

  const allTools = useMemo<ToolEntry[]>(
    () =>
      toolGroups.flatMap((group) =>
        group.tools.map((tool) => ({
          ...tool,
          group: group.name,
          hint: TOOL_HINTS[tool.id] ?? group.name,
        })),
      ),
    [toolGroups],
  )

  const featuredTools = useMemo(
    () =>
      FEATURED_IDS.map((id) => allTools.find((tool) => tool.id === id)).filter(
        (tool): tool is ToolEntry => tool !== undefined,
      ),
    [allTools],
  )

  const normalizedQuery = query.trim().toLowerCase()

  const filteredTools = useMemo(() => {
    if (normalizedQuery) {
      return allTools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(normalizedQuery) ||
          tool.group.toLowerCase().includes(normalizedQuery) ||
          tool.hint.toLowerCase().includes(normalizedQuery),
      )
    }
    return allTools.filter((tool) => !FEATURED_IDS.includes(tool.id))
  }, [allTools, normalizedQuery])

  const showFeatured = !normalizedQuery

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex h-full max-w-3xl flex-col px-8 py-10">
        <header className="mb-8 shrink-0">
          <p className="text-sm text-muted-foreground">Dev Tools</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            选择工具
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            搜索或点击图标，快速进入对应功能
          </p>

          <div className="relative mt-6">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索工具，例如 JSON、剪切板、编码..."
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25 focus:ring-2 focus:ring-foreground/5"
            />
          </div>
        </header>

        <div className="flex-1 space-y-8 pb-6">
          {showFeatured && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                常用
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {featuredTools.map((tool) => (
                  <ToolTile key={tool.id} tool={tool} onSelect={onSelect} size="large" />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {normalizedQuery ? '搜索结果' : '全部工具'}
              </h2>
              <span className="text-xs text-muted-foreground">{filteredTools.length} 个</span>
            </div>

            {filteredTools.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {filteredTools.map((tool) => (
                  <ToolTile key={tool.id} tool={tool} onSelect={onSelect} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
                <span className="text-3xl mb-3 opacity-60">🔍</span>
                <p className="text-sm font-medium text-foreground">没有找到匹配的工具</p>
                <p className="mt-1 text-xs text-muted-foreground">试试其他关键词</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
