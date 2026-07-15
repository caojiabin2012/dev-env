import { useCallback, useEffect, useMemo, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  getStackState,
  setInstallRoot,
  pickInstallRoot,
  pickComponentSource,
  setComponentVersion,
  switchComponentVersion,
  downloadComponent,
  installComponent,
  startComponent,
  stopComponent,
  uninstallComponent,
  startAllComponents,
  stopAllComponents,
  openInstallRoot,
  openWwwRoot,
  openSite,
  addSite,
  deleteSite,
  updateSite,
  setDefaultSite,
  openSiteById,
  openSiteRoot,
  pickSiteRoot,
  openComponentConfig,
  pickWwwSubdir,
  updateStackSettings,
  setComponentBootAutostart,
  setComponentPathEnv,
  setComponentPort,
  regenerateConfigs,
  getSystemMetrics,
  openComponentLog,
  startSite,
  stopSite,
  type StackState,
  type DownloadProgress,
  type SystemMetrics,
  downloadProgressKey,
} from '@/lib/stack-api'
import { IconFolder, IconPlay, IconStop } from './icons'
import { DashboardView } from './dashboard'
import { buildVersionRows, CLI_TOOL_DEPS, getMiddleSections, type MiddleNavId, type VersionRow } from './package-model'
import { getLocale, setLocale, t, type LocaleId } from '@/lib/i18n'
import { dashboardCardsEqual } from './dashboard-model'
import { findRunningWebServer } from './web-server-utils'
import { PackageVersionList, RefreshButton } from './package-table'
import { WebsitesView } from './websites'
import { Sidebar, SectionTitle, type PrimaryNavId } from './servbay-shell'
import { Btn, ConfirmDialog, Toast } from './ui'
import { isTauriEnv } from '@/lib/tauri'

const POLL_INTERVAL_MS = 5000
const METRICS_INTERVAL_MS = 2000

function bootAutostartEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k] ?? false) !== (b[k] ?? false)) return false
  }
  return true
}

function stackStateEqual(a: StackState, b: StackState): boolean {
  if (a.install_root !== b.install_root) return false
  if (a.settings?.www_subdir !== b.settings?.www_subdir) return false
  if (!bootAutostartEqual(a.settings?.boot_autostart ?? {}, b.settings?.boot_autostart ?? {})) return false
  if (!dashboardCardsEqual(a.settings?.dashboard_cards, b.settings?.dashboard_cards)) return false
  if (a.components.length !== b.components.length) return false
  if (a.sites.length !== b.sites.length) return false
  for (let i = 0; i < a.sites.length; i++) {
    const x = a.sites[i]
    const y = b.sites[i]
    if (x.id !== y.id || x.is_default !== y.is_default || x.hostname !== y.hostname
      || x.port !== y.port || x.process_running !== y.process_running
      || x.runtime_ready !== y.runtime_ready || x.web_server_running !== y.web_server_running
      || x.web_server_installed !== y.web_server_installed) return false
  }
  for (let i = 0; i < a.components.length; i++) {
    const x = a.components[i]
    const y = b.components[i]
    if (x.id !== y.id || x.status !== y.status || x.pid !== y.pid || x.port !== y.port ||
      x.installed !== y.installed || x.downloaded !== y.downloaded ||
      x.selected_version_id !== y.selected_version_id ||
      x.in_system_path !== y.in_system_path) return false
  }
  return true
}

const BOOT_AUTOSTART_ORDER = ['nginx', 'openresty', 'php', 'mysql', 'mariadb', 'redis', 'rabbitmq'] as const

function SettingsPanel({
  state, loading, wwwSubdir, bootAutostart, installRoot,
  onWwwSubdirChange, onBootAutostartChange, onBootAutostartSave, onInstallRootChange,
  onSave, onPickWww, onPickRoot, onSaveRoot, onOpenSite, onRegenerate, onCopyMysql,
  onOpenWww, onPickLocalSource,
}: {
  state: StackState; loading: boolean; wwwSubdir: string
  bootAutostart: Record<string, boolean>; installRoot: string
  onWwwSubdirChange: (v: string) => void
  onBootAutostartChange: (component: string, enabled: boolean) => void
  onBootAutostartSave: () => void
  onInstallRootChange: (v: string) => void
  onSave: () => void; onPickWww: () => void; onPickRoot: () => void; onSaveRoot: () => void
  onOpenSite: () => void; onRegenerate: () => void; onCopyMysql: () => void
  onOpenWww: () => void; onPickLocalSource: () => void
}) {
  const info = state.env_info
  const webRunning = findRunningWebServer(state.components) != null
  return (
    <div className="max-w-2xl space-y-4 pb-4">
      <div className="sb-row-card p-4 space-y-3">
        <div className="text-sm font-medium">环境根目录</div>
        <div className="flex gap-2">
          <input value={installRoot} onChange={(e) => onInstallRootChange(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--sb-border)] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]/30" />
          <Btn onClick={onPickRoot}>浏览</Btn>
          <Btn variant="primary" onClick={onSaveRoot}>保存</Btn>
        </div>
      </div>
      <div className="sb-row-card p-4 space-y-3">
        <div className="text-sm font-medium">网站目录</div>
        <div className="flex gap-2">
          <input value={wwwSubdir} onChange={(e) => onWwwSubdirChange(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--sb-border)] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]/30" />
          <Btn disabled={loading || !state.install_root} onClick={onPickWww}>浏览</Btn>
          <Btn variant="primary" disabled={loading || !state.install_root} onClick={onSave}>保存</Btn>
        </div>
        {info.www_root && <code className="text-[11px] text-[var(--sb-muted)] break-all">{info.www_root}</code>}
      </div>
      <div className="sb-row-card p-4 space-y-2 text-xs">
        <div className="text-sm font-medium mb-2">快捷操作</div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" disabled={!state.install_root} onClick={onOpenWww}>打开 www</Btn>
          <Btn size="sm" disabled={!webRunning} onClick={onOpenSite}>打开站点</Btn>
          <Btn size="sm" disabled={loading || !state.install_root} onClick={onPickLocalSource}>本地 PHP 包</Btn>
        </div>
      </div>
      <div className="sb-row-card p-4 space-y-2 text-xs">
        <div className="text-sm font-medium mb-2">连接信息</div>
        {info.site_url && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--sb-muted)]">Web</span>
            <code>{info.site_url}</code>
            <Btn size="sm" disabled={!webRunning} onClick={onOpenSite}>打开</Btn>
          </div>
        )}
        {info.mysql_port && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--sb-muted)]">MySQL</span>
            <code>{info.mysql_host}:{info.mysql_port}</code>
            <Btn size="sm" onClick={onCopyMysql}>复制</Btn>
          </div>
        )}
        {info.php_fastcgi && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--sb-muted)]">PHP</span>
            <code>{info.php_fastcgi}</code>
          </div>
        )}
        {info.composer_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">Composer</span>
            <code className="truncate" title={info.composer_cmd}>{info.composer_cmd}</code>
          </div>
        )}
        {info.python_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">Python</span>
            <code className="truncate" title={info.python_cmd}>{info.python_cmd}</code>
          </div>
        )}
        {info.pip_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">pip</span>
            <code className="truncate" title={info.pip_cmd}>{info.pip_cmd}</code>
          </div>
        )}
        {info.go_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">Go</span>
            <code className="truncate" title={info.go_cmd}>{info.go_cmd}</code>
          </div>
        )}
        {info.java_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">Java</span>
            <code className="truncate" title={info.java_cmd}>{info.java_cmd}</code>
          </div>
        )}
        {info.node_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">Node</span>
            <code className="truncate" title={info.node_cmd}>{info.node_cmd}</code>
          </div>
        )}
        {info.npm_cmd && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[var(--sb-muted)] shrink-0">npm</span>
            <code className="truncate" title={info.npm_cmd}>{info.npm_cmd}</code>
          </div>
        )}
      </div>
      <div className="sb-row-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">开机自启动</div>
            <p className="text-[11px] text-[var(--sb-muted)] mt-1 leading-relaxed">
              按组件单独设置；勾选并保存后，系统开机时仅启动已勾选的已安装组件。
            </p>
          </div>
          <Btn size="sm" variant="primary" disabled={loading || !state.install_root} onClick={onBootAutostartSave}>
            保存
          </Btn>
        </div>
        <div className="space-y-2">
          {BOOT_AUTOSTART_ORDER.map((id) => {
            const comp = state.components.find((c) => c.id === id)
            const installed = comp?.installed ?? false
            const label = comp?.name ?? id
            return (
              <label
                key={id}
                className={`flex items-center gap-3 rounded-lg border border-[var(--sb-border)] px-3 py-2.5 ${
                  installed ? 'cursor-pointer bg-white' : 'cursor-not-allowed bg-[var(--sb-hover)]/40 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!installed || loading}
                  checked={bootAutostart[id] ?? false}
                  onChange={(e) => onBootAutostartChange(id, e.target.checked)}
                  className="accent-[var(--sb-accent)]"
                />
                <span className="flex-1 text-xs text-[var(--sb-text-secondary)]">
                  {label}
                  {!installed && <span className="text-[var(--sb-muted)]">（未安装）</span>}
                </span>
              </label>
            )
          })}
        </div>
      </div>
      <Btn disabled={loading || !state.install_root} onClick={onRegenerate}>重新生成配置</Btn>
    </div>
  )
}

function LoadingPanel({ text, error, onRetry }: { text?: string; error?: string | null; onRetry?: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="sb-row-card px-6 py-5 max-w-md w-full space-y-3">
        {!error ? (
          <div className="flex items-center gap-3 text-sm text-[var(--sb-text-secondary)]">
            <span className="h-5 w-5 border-2 border-[var(--sb-accent)] border-t-transparent rounded-full animate-spin shrink-0" />
            {text ?? '加载中…'}
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-red-600">加载失败</div>
            <p className="text-xs text-[var(--sb-muted)] break-all">{error}</p>
            {onRetry && <Btn size="sm" variant="primary" onClick={onRetry}>重试</Btn>}
          </>
        )}
      </div>
    </div>
  )
}

export function StackPanel() {
  const [primaryNav, setPrimaryNav] = useState<PrimaryNavId>('dashboard')
  const [middleNav, setMiddleNav] = useState<MiddleNavId>('nginx')
  const [locale, setLocaleState] = useState<LocaleId>(getLocale)
  const [state, setState] = useState<StackState | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [dashSearch, setDashSearch] = useState('')
  const [installRoot, setInstallRootInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({})
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({})
  const [localSources, setLocalSources] = useState<Record<string, string>>({})
  const [wwwSubdir, setWwwSubdir] = useState('www/default')
  const [bootAutostart, setBootAutostart] = useState<Record<string, boolean>>({})
  const [portDrafts, setPortDrafts] = useState<Record<string, number>>({})
  const [initError, setInitError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onOk: () => void } | null>(null)

  const versionRows = useMemo(
    () => buildVersionRows(state?.components ?? [], middleNav),
    [state, middleNav]
  )

  const menuSections = useMemo(() => getMiddleSections(), [locale])

  useEffect(() => {
    const onLocale = (e: Event) => {
      const detail = (e as CustomEvent<LocaleId>).detail
      setLocaleState(detail)
    }
    window.addEventListener('devenv:locale-change', onLocale)
    return () => window.removeEventListener('devenv:locale-change', onLocale)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await getStackState()
      setInitError(null)
      setState((prev) => (prev && stackStateEqual(prev, next) ? prev : next))
      if (next.install_root) setInstallRootInput((p) => (p === next.install_root ? p : next.install_root!))
      if (next.settings?.www_subdir) setWwwSubdir((p) => (p === next.settings!.www_subdir ? p : next.settings!.www_subdir))
      if (next.settings) {
        const nextBoot = next.settings.boot_autostart ?? {}
        setBootAutostart((p) => (bootAutostartEqual(p, nextBoot) ? p : nextBoot))
      }
    } catch (e) {
      console.error(e)
      setInitError(String(e))
    }
  }, [])

  useEffect(() => {
    refresh()
    let t: ReturnType<typeof setInterval> | undefined
    const start = () => { if (!t) t = setInterval(refresh, POLL_INTERVAL_MS) }
    const stop = () => { if (t) { clearInterval(t); t = undefined } }
    const onVis = () => { document.hidden ? stop() : (refresh(), start()) }
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [refresh])

  useEffect(() => {
    if (!isTauriEnv()) return
    const u = listen<DownloadProgress>('stack-download-progress', (e) => {
      const key = downloadProgressKey(e.payload.component, e.payload.version_id)
      setProgress((p) => ({ ...p, [key]: e.payload }))
    })
    return () => { u.then((fn) => fn()) }
  }, [])

  const refreshMetrics = useCallback(async () => {
    try {
      const m = await getSystemMetrics()
      setMetrics(m)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    if (primaryNav !== 'dashboard') return
    refreshMetrics()
    const t = setInterval(refreshMetrics, METRICS_INTERVAL_MS)
    return () => clearInterval(t)
  }, [primaryNav, refreshMetrics])

  const setRowBusyKey = useCallback((key: string, busy: boolean) => {
    setRowBusy((prev) => {
      if (busy) return { ...prev, [key]: true }
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const runRowInstall = useCallback(async (row: VersionRow, fn: () => Promise<void>) => {
    const key = downloadProgressKey(row.componentId, row.versionId)
    setRowBusyKey(key, true)
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setRowBusyKey(key, false)
    }
  }, [refresh, setRowBusyKey])

  const run = async (fn: () => Promise<void>) => {
    setLoading(true); setError(null); setMessage(null)
    try { await fn(); await refresh() } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const ensureRoot = () => {
    if (!installRoot.trim() && !state?.install_root) throw new Error('请先设置环境安装目录')
  }

  const resolveRowPort = useCallback((row: VersionRow) => {
    if (row.installed && row.port != null) return row.port
    return portDrafts[row.componentId] ?? row.defaultPort
  }, [portDrafts])

  const installRow = async (row: VersionRow) => {
    ensureRoot()
    const depId = CLI_TOOL_DEPS[row.componentId as keyof typeof CLI_TOOL_DEPS]
    if (depId) {
      const dep = state?.components.find((c) => c.id === depId)
      if (!dep?.installed) {
        throw new Error(`请先安装 ${dep?.name ?? depId}，再安装 ${row.packageName}`)
      }
    }
    if (!state?.install_root) await setInstallRoot(installRoot.trim())
    await setComponentVersion(row.componentId, row.versionId)
    const refreshed = await getStackState()
    const updated = refreshed.components.find((c) => c.id === row.componentId)!
    if (!updated.downloaded && !localSources[row.componentId]) {
      await downloadComponent(row.componentId, row.versionId)
    }
    await installComponent({
      component: row.componentId,
      source_path: localSources[row.componentId],
      port: resolveRowPort(row),
      version_id: row.versionId,
    })
    setMessage(`${row.packageName} 安装完成`)
  }

  const changeComponentPort = useCallback(async (componentId: string, port: number) => {
    await setComponentPort(componentId, port)
    const name = state?.components.find((c) => c.id === componentId)?.name ?? componentId
    setMessage(`${name} 端口已改为 ${port}`)
  }, [state?.components])

  const rowHandlers = {
    onInstall: (row: VersionRow) => runRowInstall(row, () => installRow(row)),
    onUninstall: (row: VersionRow) => {
      setConfirm({
        title: '卸载组件',
        message: `确定要卸载 ${row.packageName} 吗？`,
        danger: true,
        onOk: () => run(async () => {
          await uninstallComponent(row.componentId)
          setMessage('已卸载')
        }),
      })
    },
    onStart: (row: VersionRow) => run(async () => { await startComponent(row.componentId); setMessage('已启动') }),
    onStop: (row: VersionRow) => run(async () => { await stopComponent(row.componentId); setMessage('已停止') }),
    onOpenConfig: (row: VersionRow) => openComponentConfig(row.componentId).catch((e) => setError(String(e))),
    onSetVersion: (row: VersionRow) => {
      const applySwitch = () => run(async () => {
        await switchComponentVersion(row.componentId, row.versionId, row.component.status === 'running')
        setMessage(`${row.packageName} 已启用`)
      })
      if (row.component.status === 'running') {
        setConfirm({
          title: '启用版本',
          message: `启用 ${row.packageName} 需要先停止当前运行实例，然后自动重新启动。确定继续吗？`,
          onOk: applySwitch,
        })
        return
      }
      applySwitch()
    },
    onTogglePathEnv: (row: VersionRow) => run(async () => {
      const enabled = !row.component.in_system_path
      const result = await setComponentPathEnv(row.componentId, enabled)
      let msg = enabled ? '已加入系统环境变量' : '已取消系统环境变量'
      if (result.removed.length > 0) {
        msg += `，移除了 ${result.removed.length} 个旧路径`
      }
      if (result.system_blocked.length > 0) {
        msg += `。⚠ 系统 PATH 中有 ${result.system_blocked.join(', ')}，请以管理员身份运行以移除`
      }
      setMessage(msg)
    }),
    onPortChange: (row: VersionRow, port: number) => {
      if (row.installed) {
        run(async () => { await changeComponentPort(row.componentId, port) })
        return
      }
      setPortDrafts((prev) => ({ ...prev, [row.componentId]: port }))
    },
  }

  const restartComponent = async (id: string) => {
    await stopComponent(id)
    await startComponent(id)
  }

  return (
    <div className="sb-app flex h-full">
      <Sidebar
        primaryNav={primaryNav}
        onPrimaryNav={setPrimaryNav}
        middleNav={middleNav}
        onMiddleNav={(id) => setMiddleNav(id as MiddleNavId)}
        sections={menuSections}
        components={state?.components ?? []}
        onStartAll={(ids) => run(async () => {
          for (const id of ids) {
            try { await startComponent(id) } catch (e) { setError(String(e)) }
          }
          setMessage('已全部启动')
        })}
        onStopAll={(ids) => run(async () => {
          for (const id of ids) {
            try { await stopComponent(id) } catch (e) { setError(String(e)) }
          }
          setMessage('已全部停止')
        })}
      />

      <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-[var(--sb-main-bg)] relative overflow-hidden">
        {!state?.install_root && primaryNav !== 'settings' && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-amber-200/80 bg-amber-50/90">
            <span className="text-[12px] text-amber-800">请先设置环境根目录</span>
            <input
              value={installRoot}
              onChange={(e) => setInstallRootInput(e.target.value)}
              placeholder="如 D:\dev-env"
              className="flex-1 min-w-[120px] max-w-xs rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]/30"
            />
            <Btn size="sm" disabled={loading} onClick={() => run(async () => {
              const p = await pickInstallRoot()
              if (p) { setInstallRootInput(p); await setInstallRoot(p); setMessage('目录已设置') }
            })}>浏览</Btn>
            <Btn size="sm" variant="primary" disabled={loading || !installRoot.trim()} onClick={() => run(async () => {
              await setInstallRoot(installRoot.trim()); setMessage('已保存')
            })}>保存</Btn>
          </div>
        )}

        {!state ? (
          <LoadingPanel error={initError} onRetry={() => refresh()} />
        ) : primaryNav === 'dashboard' ? (
          <DashboardView
            state={state}
            loading={loading}
            metrics={metrics}
            search={dashSearch}
            bootAutostart={state.settings?.boot_autostart ?? bootAutostart}
            dashboardCards={state.settings?.dashboard_cards ?? []}
            onSearchChange={setDashSearch}
            onStopAll={() => run(async () => { await stopAllComponents(); setMessage('全部已停止') })}
            onRestartAll={() => run(async () => {
              await stopAllComponents()
              await startAllComponents()
              setMessage('全部已重启')
            })}
            onStop={(id) => run(async () => { await stopComponent(id); setMessage('已停止') })}
            onStart={(id) => run(async () => { await startComponent(id); setMessage('已启动') })}
            onRestart={(id) => run(async () => { await restartComponent(id); setMessage('已重启') })}
            onConfig={(id) => openComponentConfig(id).catch((e) => setError(String(e)))}
            onLog={(id) => openComponentLog(id).catch((e) => setError(String(e)))}
            onBootAutostartChange={(id, enabled) => run(async () => {
              await setComponentBootAutostart(id, enabled)
              setBootAutostart((prev) => {
                const next = { ...prev }
                if (enabled) next[id] = true
                else delete next[id]
                return next
              })
              const name = state.components.find((c) => c.id === id)?.name ?? id
              setMessage(enabled ? `${name} 已加入开机自启` : `${name} 已取消开机自启`)
            })}
            onDashboardCardsChange={(cards) => run(async () => {
              await updateStackSettings({ dashboard_cards: cards })
              setMessage('仪表盘显示项已更新')
            })}
          />
        ) : primaryNav === 'websites' && state ? (
          <WebsitesView
            state={state}
            loading={loading}
            onAdd={(params) => run(async () => {
              await addSite(params)
              setMessage('站点已添加')
            })}
            onDelete={(siteId) => setConfirm({
              title: '删除站点',
              message: '确定删除该站点？（不会删除磁盘文件）',
              danger: true,
              onOk: () => run(async () => {
                await deleteSite(siteId)
                setMessage('站点已删除')
              }),
            })}
            onSetDefault={(siteId) => run(async () => {
              await setDefaultSite(siteId)
              setMessage('已设为默认站点')
            })}
            onOpen={(siteId) => openSiteById(siteId).catch((e) => setError(String(e)))}
            onOpenRoot={(siteId) => openSiteRoot(siteId).catch((e) => setError(String(e)))}
            onPickRoot={() => pickSiteRoot()}
            onStartSite={(siteId) => run(async () => {
              await startSite(siteId)
              setMessage('站点进程已启动')
            })}
            onStopSite={(siteId) => run(async () => {
              await stopSite(siteId)
              setMessage('站点进程已停止')
            })}
            onUpdateSite={(params) => run(async () => {
              await updateSite(params)
              setMessage('站点已更新')
            })}
          />
        ) : (
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {primaryNav === 'packages' ? (
            <>
              <div className="shrink-0 px-5 pt-5 pb-3">
                <SectionTitle action={<RefreshButton disabled={loading} onClick={() => refresh()} />}>
                  Packages
                </SectionTitle>
                {state?.install_root && (
                  <div className="flex flex-wrap items-center gap-2 -mt-1">
                    <Btn size="sm" variant="ghost" onClick={() => openInstallRoot().catch((e) => setError(String(e)))}>
                      <IconFolder size={14} /> 根目录
                    </Btn>
                    <Btn size="sm" variant="primary" disabled={loading} onClick={() => run(async () => { await startAllComponents(); setMessage('全部已启动') })}>
                      <IconPlay size={12} /> 全部启动
                    </Btn>
                    <Btn size="sm" disabled={loading} onClick={() => run(async () => { await stopAllComponents(); setMessage('全部已停止') })}>
                      <IconStop size={12} /> 停止
                    </Btn>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden px-5 pb-3">
                <PackageVersionList
                  rows={versionRows}
                  rowBusy={rowBusy}
                  progress={progress}
                  getProgressKey={(row) => downloadProgressKey(row.componentId, row.versionId)}
                  getPort={resolveRowPort}
                  handlers={rowHandlers}
                />
              </div>
            </>
          ) : primaryNav === 'settings' && state ? (
            <>
              <div className="shrink-0 px-5 pt-5 pb-3">
                <SectionTitle>{t('nav.settings')}</SectionTitle>
                <div className="sb-row-card p-4 space-y-3 mb-4 max-w-xl">
                  <div className="text-sm font-medium">{t('settings.language')}</div>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as LocaleId)}
                    className="w-full max-w-xs rounded-lg border border-[var(--sb-border)] bg-white px-3 py-2 text-sm"
                  >
                    <option value="zh-CN">{t('lang.zhCN')}</option>
                    <option value="en">{t('lang.en')}</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-8">
                <SettingsPanel
                  state={state} loading={loading} wwwSubdir={wwwSubdir} bootAutostart={bootAutostart} installRoot={installRoot}
                  onWwwSubdirChange={setWwwSubdir}
                  onBootAutostartChange={(component, enabled) => {
                    setBootAutostart((prev) => {
                      const next = { ...prev }
                      if (enabled) next[component] = true
                      else delete next[component]
                      return next
                    })
                  }}
                  onBootAutostartSave={() => run(async () => {
                    await updateStackSettings({ boot_autostart: bootAutostart })
                    setMessage('开机自启已保存')
                  })}
                  onInstallRootChange={setInstallRootInput}
                  onSave={() => run(async () => {
                    await updateStackSettings({ www_subdir: wwwSubdir.trim() })
                    setMessage('已保存')
                  })}
                  onPickWww={() => run(async () => {
                    const p = await pickWwwSubdir()
                    if (p) { setWwwSubdir(p); await updateStackSettings({ www_subdir: p }); setMessage('已更新') }
                  })}
                  onPickRoot={() => run(async () => {
                    const p = await pickInstallRoot()
                    if (p) { setInstallRootInput(p); await setInstallRoot(p) }
                  })}
                  onSaveRoot={() => run(async () => { await setInstallRoot(installRoot.trim()) })}
                  onOpenSite={() => openSite().catch((e) => setError(String(e)))}
                  onRegenerate={() => run(async () => { await regenerateConfigs(); setMessage('配置已生成') })}
                  onCopyMysql={() => {
                    const i = state.env_info
                    if (!i.mysql_port) return
                    navigator.clipboard.writeText(`host=${i.mysql_host}\nport=${i.mysql_port}\nuser=${i.mysql_user}\npassword=\n`)
                  }}
                  onOpenWww={() => openWwwRoot().catch((e) => setError(String(e)))}
                  onPickLocalSource={() => run(async () => {
                    const p = await pickComponentSource()
                    if (p) { setLocalSources((s) => ({ ...s, php: p })); setMessage('已选本地 PHP 包') }
                  })}
                />
              </div>
            </>
          ) : null}
        </div>
        )}

        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
          {message && !error && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] pointer-events-none flex items-center justify-center z-40">
            <div className="sb-row-card px-4 py-2 text-xs flex items-center gap-2 shadow-md">
              <span className="h-4 w-4 border-2 border-[var(--sb-accent)] border-t-transparent rounded-full animate-spin" />
              处理中…
            </div>
          </div>
        )}
      </main>

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
  )
}
