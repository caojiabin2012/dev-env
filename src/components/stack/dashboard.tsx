import { memo, useMemo, useState } from 'react'
import type { ComponentView, StackState, SystemMetrics } from '@/lib/stack-api'
import { IconConfig, IconLog, IconPlay, IconRestart, IconSearch, IconStop, SoftwareIcon } from './icons'
import { PKG_META } from './icons'
import { isCliTool, isManualManagedComponent } from './package-model'
import {
  DASHBOARD_CARD_ORDER,
  normalizeDashboardCards,
  sortDashboardCards,
  type DashboardCardId,
} from './dashboard-model'
import { Btn } from './ui'
import { DatabaseManager } from './database-manager'

const OVERVIEW_GRID =
  'grid-cols-[28px_minmax(100px,1.2fr)_minmax(65px,0.55fr)_minmax(48px,0.4fr)_minmax(70px,0.55fr)_44px_48px_100px]'

// 服务显示排序：Web 服务 → 语言 → 数据库 → 缓存/队列 → 工具
const SERVICE_ORDER: Record<string, number> = {
  nginx: 0, openresty: 1, caddy: 2,
  php: 10, python: 11, go: 12, node: 13,
  mysql: 20, mariadb: 21,
  redis: 30, rabbitmq: 31, rocketmq: 32, kafka: 33,
  composer: 40, pip: 41, npm: 42,
}

function sortServices(comps: ComponentView[]): ComponentView[] {
  return [...comps].sort((a, b) => (SERVICE_ORDER[a.id] ?? 99) - (SERVICE_ORDER[b.id] ?? 99))
}

function displayPort(comp: ComponentView): string | null {
  if (isCliTool(comp.id)) return null
  const port = comp.port ?? (comp.default_port > 0 ? comp.default_port : null)
  return port != null ? String(port) : null
}

function shortVer(label: string): string {
  const m = label.match(/(\d+\.\d+(?:\.\d+)?(?:\w+)?)/)
  return m?.[1] ?? label
}

/* ====== Service Card ====== */

const ServiceCard = memo(function ServiceCard({ comp, onDragStart }: { comp: ComponentView; onDragStart?: (e: React.DragEvent) => void }) {
  const meta = PKG_META[comp.id]
  const isRunning = comp.status === 'running'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`sb-row-card shrink-0 w-[130px] flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing ${
        isRunning
          ? 'bg-gradient-to-b from-emerald-50 to-white ring-1 ring-emerald-200 shadow-sm'
          : comp.installed
            ? 'bg-white ring-1 ring-amber-100'
            : 'bg-white opacity-60'
      }`}
    >
      <div
        className={`h-1 rounded-t-[14px] ${
          isRunning ? 'bg-emerald-500' : comp.installed ? 'bg-amber-400' : 'bg-zinc-200'
        }`}
      />
      <div className="p-2.5 flex flex-col gap-2">
        {/* Icon + Status */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="h-7 w-7 shrink-0 rounded-lg overflow-hidden">
            <SoftwareIcon id={comp.id} />
          </div>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-0.5 ${
            isRunning ? 'bg-emerald-500' : comp.installed ? 'bg-amber-400' : 'bg-zinc-300'
          }`} />
        </div>
        {/* Name + version */}
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[var(--sb-text)] truncate">{meta?.label ?? comp.name}</div>
          <div className="text-[10px] text-[var(--sb-muted)] mt-0.5">
            {comp.installed ? `v${shortVer(comp.selected_version_label)}` : '未安装'} {!isCliTool(comp.id) && displayPort(comp) && `:${displayPort(comp)}`}
          </div>
        </div>
        {/* PHP version tags */}
        {comp.id === 'php' && comp.available_versions.length > 1 && (
          <div className="flex flex-wrap gap-0.5">
            {comp.available_versions.slice(0, 3).map((v) => (
              <span key={v.id}
                className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium ${
                  comp.selected_version_id === v.id
                    ? 'bg-[var(--sb-accent-soft)] text-[var(--sb-accent)]'
                    : 'bg-[var(--sb-hover)] text-[var(--sb-muted)]'
                }`}>
                {shortVer(v.label).split('.').slice(0, 2).join('.')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

/* ====== Dashboard Card Picker ====== */

function DashboardCardPicker({
  selected,
  loading,
  onToggle,
  onReset,
}: {
  selected: DashboardCardId[]
  loading: boolean
  onToggle: (id: DashboardCardId, enabled: boolean) => void
  onReset: () => void
}) {
  const selectedSet = new Set(selected)
  return (
    <div className="sb-row-card p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-[var(--sb-text)]">自定义顶部服务卡片</div>
        <Btn size="sm" variant="ghost" disabled={loading} onClick={onReset}>
          恢复默认
        </Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        {DASHBOARD_CARD_ORDER.map((id) => {
          const meta = PKG_META[id]
          const active = selectedSet.has(id)
          const onlyOne = active && selected.length <= 1
          return (
            <button
              key={id}
              type="button"
              disabled={loading || onlyOne}
              title={onlyOne ? '至少保留一个' : undefined}
              onClick={() => onToggle(id, !active)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] transition-all duration-150 ${
                active
                  ? 'border-[var(--sb-accent)] bg-[var(--sb-accent-soft)] text-[var(--sb-accent)] font-medium shadow-sm'
                  : 'border-[var(--sb-border)] bg-white text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)] hover:border-zinc-300'
              } disabled:opacity-50`}
            >
              <span className="h-5 w-5 rounded overflow-hidden">
                <SoftwareIcon id={id} />
              </span>
              {meta?.label ?? id}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-[var(--sb-muted)]">点击切换显示；首页可拖拽卡片排序</p>
    </div>
  )
}

/* ====== Tiny CPU / MEM inline indicators ====== */

function CpuDot({ pct }: { pct: number }) {
  const p = Math.min(Math.max(pct, 0), 100)
  const color = p > 85 ? '#ef4444' : p > 60 ? '#f59e0b' : 'var(--sb-accent)'
  return (
    <div className="flex items-center gap-1.5" title={`CPU ${p.toFixed(0)}%`}>
      <svg width={18} height={18} className="shrink-0">
        <circle cx={9} cy={9} r={7} fill="none" stroke="var(--sb-border)" strokeWidth={2} />
        <circle cx={9} cy={9} r={7} fill="none" stroke={color}
          strokeWidth={2} strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 7} strokeDashoffset={2 * Math.PI * 7 * (1 - p / 100)}
          transform="rotate(-90 9 9)" className="transition-all duration-700 ease-out" />
      </svg>
      <span className="font-semibold tabular-nums text-[var(--sb-text-secondary)]">{p.toFixed(0)}%</span>
    </div>
  )
}

function MemStrip({ pct }: { pct: number }) {
  const p = Math.min(Math.max(pct, 0), 100)
  const color = p > 85 ? '#ef4444' : '#f59e0b'
  return (
    <div className="flex items-center gap-1.5" title={`MEM ${p.toFixed(0)}%`}>
      <span className="text-[var(--sb-muted)] font-medium">MEM</span>
      <div className="h-2 w-14 rounded-full bg-[var(--sb-border)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
      <span className="font-semibold tabular-nums text-[var(--sb-text-secondary)]">{p.toFixed(0)}%</span>
    </div>
  )
}

/* ====== Overview Row ====== */

function OverviewRow({
  index,
  comp,
  loading,
  bootAutostart,
  onStop,
  onStart,
  onRestart,
  onConfig,
  onLog,
  onBootAutostartChange,
  onManageDb,
}: {
  index?: number
  comp: ComponentView
  loading: boolean
  bootAutostart: boolean
  onStop: () => void
  onStart: () => void
  onRestart: () => void
  onConfig: () => void
  onLog: () => void
  onBootAutostartChange: (enabled: boolean) => void
  onManageDb?: () => void
}) {
  const meta = PKG_META[comp.id]
  const isCli = isCliTool(comp.id)
  const isManual = isManualManagedComponent(comp.id)
  const isRunning = comp.status === 'running'

  return (
    <div className={`sb-row-card grid ${OVERVIEW_GRID} items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--sb-hover)] ${
      isRunning ? 'bg-gradient-to-r from-emerald-50 to-transparent' : ''
    }`}>
      <div className="text-center text-[11px] text-[var(--sb-muted)]/50 tabular-nums">{index}</div>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-6 w-6 shrink-0 rounded-md overflow-hidden">
          <SoftwareIcon id={comp.id} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[var(--sb-text)] truncate">{meta?.label ?? comp.name}</div>
        </div>
      </div>
      <div className="text-[11px] font-mono text-[var(--sb-text-secondary)] truncate tabular-nums">
        v{shortVer(comp.selected_version_label)}
      </div>
      <div className="text-center text-[11px] font-mono text-[var(--sb-muted)] tabular-nums">
        {displayPort(comp) ?? '—'}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full shrink-0 ${isRunning ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <span className={`text-[11px] font-medium ${isRunning ? 'text-emerald-600' : 'text-amber-500'}`}>
          {isRunning ? '运行' : '停止'}
        </span>
      </div>
      <div className="text-center text-[11px] font-mono text-[var(--sb-muted)] opacity-60 tabular-nums">
        {comp.pid ?? '—'}
      </div>
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={bootAutostart}
          disabled={loading || !comp.installed}
          onChange={(e) => onBootAutostartChange(e.target.checked)}
          className="accent-[var(--sb-accent)] scale-90 cursor-pointer"
        />
      </div>
      <div className="flex items-center justify-end gap-0.5">
        {!isCli && !isManual && (
          isRunning ? (
            <>
              <button type="button" title="停止" disabled={loading} onClick={onStop}
                className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-red-500 hover:bg-red-50 disabled:opacity-25 transition-colors">
                <IconStop size={14} />
              </button>
              <button type="button" title="重启" disabled={loading} onClick={onRestart}
                className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-accent)] hover:bg-[var(--sb-accent-soft)] disabled:opacity-25 transition-colors">
                <IconRestart size={14} />
              </button>
            </>
          ) : (
            <button type="button" title="启动" disabled={loading} onClick={onStart}
              className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-25 transition-colors">
              <IconPlay size={14} />
            </button>
          )
        )}
        {isManual && (
          <span className="px-2 py-1 text-[10px] text-[var(--sb-text-secondary)]">手动</span>
        )}
        <button type="button" title="配置" disabled={loading} onClick={onConfig}
          className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] disabled:opacity-25 transition-colors">
          <IconConfig size={14} />
        </button>
        <button type="button" title="日志" disabled={loading} onClick={onLog}
          className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] disabled:opacity-25 transition-colors">
          <IconLog size={14} />
        </button>
        {onManageDb && (
          <button type="button" title="管理数据库" disabled={loading} onClick={onManageDb}
            className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-purple-500 hover:bg-purple-50 disabled:opacity-25 transition-colors">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="6" rx="8" ry="3" />
              <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
              <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/* ====== Dashboard View ====== */

export function DashboardView({
  state,
  loading,
  metrics,
  search,
  bootAutostart,
  dashboardCards,
  onSearchChange,
  onStopAll,
  onRestartAll,
  onStop,
  onStart,
  onRestart,
  onConfig,
  onLog,
  onBootAutostartChange,
  onDashboardCardsChange,
}: {
  state: StackState
  loading: boolean
  metrics: SystemMetrics | null
  search: string
  bootAutostart: Record<string, boolean>
  dashboardCards: string[]
  onSearchChange: (v: string) => void
  onStopAll: () => void
  onRestartAll: () => void
  onStop: (id: string) => void
  onStart: (id: string) => void
  onRestart: (id: string) => void
  onConfig: (id: string) => void
  onLog: (id: string) => void
  onBootAutostartChange: (id: string, enabled: boolean) => void
  onDashboardCardsChange: (cards: string[]) => void
}) {
  const [showCardPicker, setShowCardPicker] = useState(false)
  const [dbManagerComp, setDbManagerComp] = useState<ComponentView | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const cardIds = useMemo(
    () => sortDashboardCards(normalizeDashboardCards(dashboardCards)),
    [dashboardCards],
  )

  const cardComponents = useMemo(() => {
    const map = new Map(state.components.map((c) => [c.id, c]))
    return cardIds.map((id) => map.get(id)).filter(Boolean) as ComponentView[]
  }, [state.components, cardIds])

  const installed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.components
      .filter((c) => c.installed && !isCliTool(c.id))
      .filter((c) => {
        if (!q) return true
        const meta = PKG_META[c.id]
        return (meta?.label ?? c.name).toLowerCase().includes(q) || c.selected_version_label.toLowerCase().includes(q)
      })
  }, [state.components, search])

  const stats = useMemo(() => {
    const all = state.components.filter((c) => !isCliTool(c.id))
    return {
      total: all.filter((c) => c.installed).length,
      running: all.filter((c) => c.status === 'running').length,
    }
  }, [state.components])

  const handleToggleCard = (id: DashboardCardId, enabled: boolean) => {
    const next = enabled
      ? sortDashboardCards([...cardIds, id])
      : cardIds.filter((x) => x !== id)
    if (next.length === 0) return
    onDashboardCardsChange(next)
  }

  const handleResetCards = () => {
    onDashboardCardsChange(normalizeDashboardCards(undefined))
  }

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    setDragId(id)
  }

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragId) setDragOverId(id)
  }

  const handleDragLeave = () => setDragOverId(null)

  const handleDrop = (targetId: string) => () => {
    setDragOverId(null)
    setDragId(null)
    if (!dragId || dragId === targetId) return
    const ids = [...cardIds]
    const from = ids.indexOf(dragId as DashboardCardId)
    const to = ids.indexOf(targetId as DashboardCardId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragId as DashboardCardId)
    onDashboardCardsChange(ids)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-[var(--sb-border)]">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--sb-text)]">Dashboard</h1>
          <p className="text-[11px] text-[var(--sb-muted)] mt-0.5">
            已安装 {stats.total} 个服务 · {stats.running} 个运行中
          </p>
        </div>

        <div className="flex-1" />

        {/* CPU + MEM inline */}
        {metrics && (
          <div className="flex items-center gap-3 mr-1 text-[10px]">
            <CpuDot pct={metrics.cpu_percent ?? 0} />
            <span className="text-[var(--sb-border)] select-none">|</span>
            <MemStrip pct={metrics.memory_percent ?? 0} />
          </div>
        )}

        <Btn size="sm" variant={showCardPicker ? 'primary' : 'ghost'} disabled={loading}
          onClick={() => setShowCardPicker((v) => !v)}>
          显示项 ({cardIds.length})
        </Btn>

        <div className="relative">
          <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sb-muted)]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索已安装服务…"
            className="h-8 w-[170px] rounded-lg border border-[var(--sb-border)] bg-[var(--sb-panel)] pl-8 pr-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)] transition-shadow"
          />
        </div>

        <Btn size="sm" variant="ghost" disabled={loading} onClick={onStopAll}
          className="text-amber-600 hover:bg-amber-50">
          <IconStop size={12} /> 全部停止
        </Btn>
        <Btn size="sm" variant="primary" disabled={loading} onClick={onRestartAll}>
          <IconRestart size={12} /> 全部重启
        </Btn>
      </div>

      {/* Card Picker */}
      {showCardPicker && (
        <div className="shrink-0 px-5 pt-3 pb-1">
          <DashboardCardPicker
            selected={cardIds}
            loading={loading}
            onToggle={handleToggleCard}
            onReset={handleResetCards}
          />
        </div>
      )}

      {/* Service Cards — 拖拽排序 */}
      <div className="shrink-0 px-5 pt-4 pb-3 overflow-x-auto">
        {cardComponents.length > 0 && (
          <p className="text-[10px] text-[var(--sb-muted)] mb-2 opacity-60">拖拽卡片可自定义排序</p>
        )}
        <div className="flex gap-3 min-w-max">
          {cardComponents.map((c) => (
            <div
              key={c.id}
              onDragOver={handleDragOver(c.id)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(c.id)}
              className={`rounded-[14px] transition-all ${dragOverId === c.id ? 'ring-2 ring-[var(--sb-accent)] scale-105' : ''}`}
            >
              <ServiceCard comp={c} onDragStart={handleDragStart(c.id)} />
            </div>
          ))}
          {cardComponents.length === 0 && (
            <div className="text-[12px] text-[var(--sb-muted)] py-4">尚未选择顶部卡片，点击「显示项」添加</div>
          )}
        </div>
      </div>

      {/* Overview Table */}
      <div className="flex-1 flex flex-col min-h-0 px-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[12px] font-bold text-[var(--sb-text)] uppercase tracking-wider">已安装服务</h2>
          <span className="text-[10px] text-[var(--sb-muted)] tabular-nums">{installed.length} 个服务</span>
        </div>

        {/* Table Header */}
        <div className={`grid ${OVERVIEW_GRID} gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider bg-[var(--sb-hover)] rounded-t-lg border border-b-0 border-[var(--sb-border)]`}
          style={{ color: 'var(--sb-muted)', opacity: 0.7 }}>
          <div className="text-center">#</div>
          <div>名称</div>
          <div>版本</div>
          <div className="text-center">端口</div>
          <div>状态</div>
          <div className="text-center">PID</div>
          <div className="text-center">自启</div>
          <div className="text-right">操作</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto border-x border-b border-[var(--sb-border)] rounded-b-lg">
          {installed.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm text-[var(--sb-muted)]">暂无已安装服务</p>
              <p className="text-[11px] opacity-60 mt-1" style={{ color: 'var(--sb-muted)' }}>前往软件包页面安装一些服务</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--sb-border)]">
              {sortServices(installed).map((c, i) => (
                <OverviewRow
                  key={c.id}
                  index={i + 1}
                  comp={c}
                  loading={loading}
                  bootAutostart={bootAutostart[c.id] ?? false}
                  onStop={() => onStop(c.id)}
                  onStart={() => onStart(c.id)}
                  onRestart={() => onRestart(c.id)}
                  onConfig={() => onConfig(c.id)}
                  onLog={() => onLog(c.id)}
                  onBootAutostartChange={(enabled) => onBootAutostartChange(c.id, enabled)}
                  onManageDb={(c.id === 'mysql' || c.id === 'mariadb') ? () => setDbManagerComp(c) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Database Manager Modal */}
      {dbManagerComp && (
        <DatabaseManager comp={dbManagerComp} onClose={() => setDbManagerComp(null)} />
      )}
    </div>
  )
}
