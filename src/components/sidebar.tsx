import type { ReactNode } from 'react'
import type { ToolId } from '@/App'

interface ToolGroup {
  name: string
  tools: { id: ToolId; name: string; icon: string }[]
}

interface SidebarProps {
  toolGroups: ToolGroup[]
  activeTool: ToolId
  onSelect: (id: ToolId) => void
  onOpenSettings: () => void
  hasUpdate?: boolean
  onUpdateClick?: () => void
}

function HeaderIconButton({
  title,
  onClick,
  children,
  highlight,
}: {
  title: string
  onClick: () => void
  children: ReactNode
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        highlight
          ? 'text-orange-500 hover:bg-orange-500/10'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

export function Sidebar({
  toolGroups,
  activeTool,
  onSelect,
  onOpenSettings,
  hasUpdate,
  onUpdateClick,
}: SidebarProps) {
  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelect('home')}
            className="text-lg font-semibold text-foreground flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
          >
            <span className="text-xl shrink-0">🧰</span>
            <span className="truncate">Dev Tools</span>
          </button>
          {hasUpdate && onUpdateClick && (
            <HeaderIconButton title="有新版本可用" onClick={onUpdateClick} highlight>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
              </svg>
            </HeaderIconButton>
          )}
          <HeaderIconButton title="设置" onClick={onOpenSettings}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </HeaderIconButton>
        </div>
        <p className="text-xs text-muted-foreground mt-1">开发者工具箱</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="mb-3">
          <button
            onClick={() => onSelect('home')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTool === 'home'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            <span className="font-mono text-base w-6 text-center">🏠</span>
            首页
          </button>
        </div>
        {toolGroups.map((group) => (
          <div key={group.name} className="mb-3">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {group.name}
            </div>
            <div className="space-y-0.5">
              {group.tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onSelect(tool.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTool === tool.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <span className="font-mono text-base w-6 text-center">{tool.icon}</span>
                  {tool.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
