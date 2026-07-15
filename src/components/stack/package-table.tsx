import { memo } from 'react'
import type { DownloadProgress } from '@/lib/stack-api'
import { IconConfig, IconDownload, IconInstalled, IconPin, IconRefresh, IconTrash, SoftwareIcon } from './icons'
import type { VersionRow } from './package-model'
import { isCliTool, isManualManagedComponent, supportsPathEnv, supportsPortConfig } from './package-model'
import { PortField } from './ui'

const GRID_COLS =
  'grid-cols-[28px_minmax(100px,1.2fr)_minmax(65px,0.55fr)_minmax(48px,0.4fr)_minmax(70px,0.6fr)_48px_minmax(80px,0.55fr)_80px]'

function StatusCell({ row, downloading, installing }: { row: VersionRow; downloading: boolean; installing: boolean }) {
  if (downloading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--sb-accent)]">
        <IconDownload size={14} />
        下载中
      </span>
    )
  }
  if (installing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--sb-accent)]">
        <span className="h-3 w-3 border-2 border-[var(--sb-accent)] border-t-transparent rounded-full animate-spin" />
        安装中
      </span>
    )
  }
  if (!row.installed) {
    return <span className="text-[12px] text-[var(--sb-muted)]">—</span>
  }
  if (isCliTool(row.componentId)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
        <IconInstalled size={15} className="text-emerald-500" />
        已安装
      </span>
    )
  }
  if (row.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
        <IconInstalled size={15} className="text-emerald-500" />
        运行中
      </span>
    )
  }
  if (row.status === 'stopped') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
        <IconInstalled size={15} className="text-emerald-500" />
        已安装
      </span>
    )
  }
  return <span className="text-[12px] text-amber-600">异常</span>
}

const PackageIcon = memo(function PackageIcon({ id }: { id: string }) {
  return (
    <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden">
      <SoftwareIcon id={id} />
    </div>
  )
})

export const VersionRowCard = memo(function VersionRowCard({
  row,
  rowBusy,
  downloading,
  progress,
  onInstall,
  onUninstall,
  onStart,
  onStop,
  onOpenConfig,
  onSetVersion,
  onTogglePathEnv,
  portValue,
  onPortChange,
}: {
  row: VersionRow
  rowBusy: boolean
  downloading: boolean
  progress?: DownloadProgress
  onInstall: () => void
  onUninstall: () => void
  onStart: () => void
  onStop: () => void
  onOpenConfig: () => void
  onSetVersion: () => void
  onTogglePathEnv: () => void
  portValue: number
  onPortChange: (port: number) => void
}) {
  const installing = rowBusy && !downloading
  const cliTool = isCliTool(row.componentId)
  const manualManaged = isManualManagedComponent(row.componentId)
  const isActiveInstalled = row.installed && row.isActive
  const portConfigurable = supportsPortConfig(row.componentId)
  return (
    <div className={`sb-row-card grid ${GRID_COLS} items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--sb-hover)] ${
      row.installed && row.status === 'running' ? 'bg-gradient-to-r from-emerald-50 to-transparent' : ''
    }`}>
      {/* # */}
      <div className="text-center text-[11px] text-[var(--sb-muted)] tabular-nums">
        {row.installed ? (row.status === 'running' ? '●' : '○') : '—'}
      </div>

      {/* Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-6 w-6 shrink-0 rounded-md overflow-hidden">
          <PackageIcon id={row.componentId} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[var(--sb-text)] truncate">{row.packageName}</div>
          {row.hasUpdate && <span className="text-[9px] text-amber-500 font-medium">可更新</span>}
        </div>
      </div>

      {/* Version */}
      <div className="text-[11px] font-mono text-[var(--sb-text-secondary)] truncate tabular-nums">
        v{row.versionNumber}
        {row.isActive && <IconPin size={10} className="inline ml-1 text-emerald-500" />}
      </div>

      {/* Port */}
      <div className="text-center">
        {cliTool ? (
          <span className="text-[11px] text-[var(--sb-muted)]">—</span>
        ) : !portConfigurable ? (
          row.installed ? (
            <span className="text-[11px] text-[var(--sb-text-secondary)] tabular-nums">
              {row.port ?? '—'}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--sb-muted)]">—</span>
          )
        ) : isActiveInstalled ? (
          <PortField
            value={portValue}
            disabled={row.status === 'running'}
            loading={false}
            onSave={onPortChange}
          />
        ) : row.installed ? (
          <span className="text-[11px] text-[var(--sb-text-secondary)] tabular-nums">
            {row.port ?? '—'}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--sb-muted)]">{portValue}</span>
        )}
      </div>

      {/* Status */}
      <div>
        {!row.installed ? (
          <span className="text-[11px] text-[var(--sb-muted)]">未安装</span>
        ) : row.status === 'running' ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            运行中
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            已停止
          </span>
        )}
      </div>

      {/* Start/Stop */}
      <div className="flex justify-center">
        {!row.installed ? (
          <span className="text-[11px] text-[var(--sb-muted)]">—</span>
        ) : row.isActive ? (
          !cliTool && !manualManaged ? (
            <button
              type="button"
              disabled={rowBusy}
              onClick={row.status === 'running' ? onStop : onStart}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30 ${
                row.status === 'running'
                  ? 'text-[var(--sb-muted)] hover:text-red-500 hover:bg-red-50'
                  : 'text-[var(--sb-accent)] hover:bg-[var(--sb-accent-soft)]'
              }`}
            >
              {row.status === 'running' ? '停止' : '启动'}
            </button>
          ) : manualManaged ? (
            <span className="text-[11px] text-[var(--sb-text-secondary)]">手动</span>
          ) : (
            <span className="text-[11px] text-emerald-600">已启用</span>
          )
        ) : (
          <button
            type="button"
            disabled={rowBusy}
            onClick={onSetVersion}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[var(--sb-accent)] transition-colors hover:bg-[var(--sb-accent-soft)] disabled:opacity-30"
          >
            启用
          </button>
        )}
      </div>

      {/* Path Env */}
      <div className="flex justify-center">
        {isActiveInstalled && supportsPathEnv(row.componentId) ? (
          <button
            type="button"
            onClick={onTogglePathEnv}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
              row.component.in_system_path
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'text-[var(--sb-muted)] hover:text-[var(--sb-accent)] hover:bg-[var(--sb-accent-soft)]'
            }`}
          >
            {row.component.in_system_path ? '已加' : '加入'}
          </button>
        ) : (
          <span className="text-[11px] text-[var(--sb-muted)]">—</span>
        )}
      </div>

      {/* Install / Uninstall */}
      <div className="flex justify-center">
        {!row.installed ? (
          <button
            type="button"
            disabled={rowBusy}
            onClick={onInstall}
            className="inline-flex items-center justify-center gap-1 h-7 px-3 rounded-lg bg-[var(--sb-accent)] text-white text-[11px] font-medium transition-colors hover:opacity-90 disabled:opacity-40"
          >
            <IconDownload size={12} />
            {downloading && progress?.percent != null ? `${progress.percent.toFixed(0)}%` : installing ? '...' : '安装'}
          </button>
        ) : row.isActive ? (
          <button
            type="button"
            disabled={rowBusy}
            onClick={onUninstall}
            title="卸载"
            className="p-1.5 rounded-md text-[var(--sb-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <IconTrash size={15} />
          </button>
        ) : (
          <span className="text-[11px] text-[var(--sb-muted)]">—</span>
        )}
      </div>

      {downloading && progress && (
        <div className="col-span-full pl-12 pr-1">
          <div className="h-1 rounded-full bg-[var(--sb-border)] overflow-hidden">
            <div
              className="h-full bg-[var(--sb-accent)] transition-all duration-300"
              style={{ width: `${Math.min(progress.percent ?? 5, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
})

export function PackageVersionList({
  rows,
  rowBusy,
  progress,
  getProgressKey,
  getPort,
  handlers,
}: {
  rows: VersionRow[]
  rowBusy: Record<string, boolean>
  progress: Record<string, DownloadProgress>
  getProgressKey: (row: VersionRow) => string
  getPort: (row: VersionRow) => number
  handlers: {
    onInstall: (row: VersionRow) => void
    onUninstall: (row: VersionRow) => void
    onStart: (row: VersionRow) => void
    onStop: (row: VersionRow) => void
    onOpenConfig: (row: VersionRow) => void
    onSetVersion: (row: VersionRow) => void
    onTogglePathEnv: (row: VersionRow) => void
    onPortChange: (row: VersionRow, port: number) => void
  }
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className={`grid ${GRID_COLS} gap-3 px-4 py-2 text-[10px] font-semibold text-[var(--sb-muted)] uppercase tracking-wider bg-[var(--sb-hover)] rounded-t-lg border border-b-0 border-[var(--sb-border)]`}>
        <div className="text-center">#</div>
        <div>软件包</div>
        <div>版本</div>
        <div className="text-center">端口</div>
        <div>状态</div>
        <div className="text-center">启动</div>
        <div className="text-center">环境</div>
        <div className="text-center">操作</div>
      </div>

      <div className="flex-1 overflow-y-auto border-x border-b border-[var(--sb-border)] rounded-b-lg">
        {rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--sb-muted)]">暂无软件包版本</div>
        ) : (
          rows.map((row) => {
            const pkey = getProgressKey(row)
            const p = progress[pkey]
            const busy = Boolean(rowBusy[pkey])
            const downloading = Boolean(p && (p.phase === 'downloading' || p.phase === 'connecting'))
            return (
              <div key={`${row.componentId}@${row.versionId}`}>
                <VersionRowCard
                  row={row}
                  rowBusy={busy}
                  downloading={downloading}
                  progress={p}
                  onInstall={() => handlers.onInstall(row)}
                  onUninstall={() => handlers.onUninstall(row)}
                  onStart={() => handlers.onStart(row)}
                  onStop={() => handlers.onStop(row)}
                  onOpenConfig={() => handlers.onOpenConfig(row)}
                  onSetVersion={() => handlers.onSetVersion(row)}
                  onTogglePathEnv={() => handlers.onTogglePathEnv(row)}
                  portValue={getPort(row)}
                  onPortChange={(port) => handlers.onPortChange(row, port)}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function RefreshButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title="刷新"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--sb-accent)] hover:bg-[var(--sb-accent-soft)] disabled:opacity-40 transition-colors"
    >
      <IconRefresh size={18} />
    </button>
  )
}
