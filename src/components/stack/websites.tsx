import { useEffect, useMemo, useState } from 'react'
import type { AddSiteParams, SiteRuntimeId, StackState, UpdateSiteParams, WebSiteView } from '@/lib/stack-api'
import { SITE_RUNTIME_OPTIONS } from '@/lib/stack-api'
import { IconEdit, IconExternal, IconFolder, IconGlobe, IconPin, IconPlay, IconStop, IconTrash, SoftwareIcon } from './icons'
import {
  installedWebServers,
  webServerOptionLabel,
  webServerVersions,
  WEB_SERVER_OPTIONS,
  type WebServerId,
} from './web-server-utils'
import {
  defaultVersionForRuntime,
  runtimeBadgeClass,
  versionsForRuntime,
  isProcessRuntime,
} from './site-runtime'
import { Btn, StatusPill } from './ui'

/* ====== Site Card ====== */

function SiteCard({
  index,
  site,
  loading,
  installedWebs,
  onStartStop,
  onEdit,
  onSetDefault,
  onOpen,
  onOpenRoot,
  onDelete,
}: {
  index: number
  site: WebSiteView
  loading: boolean
  installedWebs: { id: string; port?: number }[]
  onStartStop: () => void
  onEdit: () => void
  onSetDefault: () => void
  onOpen: () => void
  onOpenRoot: () => void
  onDelete: () => void
}) {
  const hasProcess = isProcessRuntime(site.runtime)
  const langIcon = { php: 'php', python: 'python', go: 'go', node: 'node' }[site.runtime] ?? null
  const isRunning = site.web_server_running || site.process_running
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={`sb-row-card grid grid-cols-[28px_28px_100px_minmax(0,1fr)_42px_minmax(0,1fr)_110px_90px_52px] gap-2 items-center px-4 py-2 transition-colors hover:bg-[var(--sb-hover)] ${
      isRunning ? 'bg-gradient-to-r from-emerald-50 to-transparent' : ''
    }`}>
      {/* # */}
      <div className="text-center text-[10px] text-[var(--sb-muted)] tabular-nums">{index}</div>

      {/* Logo */}
      <div className={`h-5 w-5 shrink-0 rounded overflow-hidden justify-self-center ${!isRunning && site.web_server_installed ? 'opacity-60' : ''}`}>
        {langIcon ? <SoftwareIcon id={langIcon} /> : <IconGlobe size={12} className="text-[var(--sb-muted)] m-0.5" />}
      </div>

      {/* 名称 */}
      <div className="truncate">
        <span className="text-[12px] font-semibold text-[var(--sb-text)]">{site.name}</span>
        {site.is_default && <IconPin size={9} className="inline ml-1 text-amber-500 shrink-0" />}
      </div>

      {/* 域名 */}
      <div className="truncate">
        <span className="text-[11px] text-[var(--sb-muted)] font-mono cursor-pointer hover:text-[var(--sb-accent)] hover:underline"
          onClick={(e) => { e.stopPropagation(); if (site.url) window.open(site.url, '_blank') }}>{site.hostname}</span>
      </div>

      {/* 端口 */}
      <div className="text-center text-[10px] text-[var(--sb-muted)] font-mono tabular-nums leading-tight">
        {(() => {
          const wsPort = installedWebs.find((c) => c.id === site.web_server)?.port
          const procPort = site.port
          if (wsPort && procPort) return <><span>{wsPort}</span><br /><span className="text-[var(--sb-accent)]">{procPort}</span></>
          if (wsPort) return <span>{wsPort}</span>
          if (procPort) return <span className="text-[var(--sb-accent)]">{procPort}</span>
          return <span>—</span>
        })()}
      </div>

      {/* 路径 */}
      <div className="truncate">
        <span className="text-[11px] text-[var(--sb-muted)] font-mono" title={site.root_abs ?? site.root}>
          {site.root}
        </span>
      </div>

      {/* Web 服务器 */}
      <div className="truncate text-[11px]">
        <span className={`inline-flex items-center gap-1 ${site.web_server_running ? 'text-emerald-600' : site.web_server_installed ? 'text-amber-500' : 'text-red-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${site.web_server_running ? 'bg-emerald-500' : site.web_server_installed ? 'bg-amber-400' : 'bg-red-400'}`} />
          {site.web_server_label}
        </span>
      </div>

      {/* 后端语言 */}
      <div className="text-[11px] truncate">
        <span className={runtimeBadgeClass(site.runtime)}>{site.runtime_label}</span>
        {hasProcess && (
          <span className="ml-1">{site.process_running ? '●' : '○'}</span>
        )}
      </div>

      {/* 设置 */}
      <div className="flex justify-center relative">
        <button type="button" disabled={loading}
          onClick={() => setMenuOpen(!menuOpen)}
          className="px-2 py-1 rounded-md text-[10px] font-medium text-[var(--sb-accent)] hover:bg-[var(--sb-accent-soft)]">
          管理
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-[var(--sb-border)] py-1 min-w-[100px]">
              <button type="button" disabled={loading} onClick={() => { setMenuOpen(false); onEdit() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)]">
                <IconEdit size={12} /> 编辑
              </button>
              <button type="button" disabled={!site.web_server_running} onClick={() => { setMenuOpen(false); onOpen() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)] disabled:opacity-30">
                <IconExternal size={12} /> 打开
              </button>
              <button type="button" disabled={loading} onClick={() => { setMenuOpen(false); onOpenRoot() }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)]">
                <IconFolder size={12} /> 目录
              </button>
              {hasProcess && (
                <button type="button" disabled={loading || !site.runtime_ready} onClick={() => { setMenuOpen(false); onStartStop() }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)]">
                  {site.process_running ? <IconStop size={12} /> : <IconPlay size={12} />}
                  {site.process_running ? '停止进程' : '启动进程'}
                </button>
              )}
              <div className="border-t border-[var(--sb-border)] my-0.5" />
              {!site.is_default && (
                <button type="button" disabled={loading} onClick={() => { setMenuOpen(false); onSetDefault() }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)]">
                  <IconPin size={12} /> 设为默认
                </button>
              )}
              {!site.is_default && (
                <button type="button" disabled={loading} onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50">
                  <IconTrash size={12} /> 删除
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ====== Site Form ====== */

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[var(--sb-text-secondary)]">{label}</span>
      {children}
    </label>
  )
}

function formInputClass() {
  return 'w-full rounded-lg border border-[var(--sb-border)] bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]/25 focus:border-[var(--sb-accent)]/40 transition-shadow placeholder:text-[var(--sb-muted)]/50'
}

function SiteForm({
  name,
  hostname,
  root,
  runtime,
  runtimeVersionId,
  webServer,
  webServerVersionId,
  installedWebs,
  versionOptions,
  wsVersionOptions,
  loading,
  submitLabel,
  editing,
  onChangeName,
  onChangeHostname,
  onChangeRoot,
  onChangeRuntime,
  onChangeVersion,
  onChangeWebServer,
  onChangeWebServerVersion,
  onPickRoot,
  onSubmit,
  onCancel,
}: {
  name: string; hostname: string; root: string
  runtime: SiteRuntimeId; runtimeVersionId: string
  webServer: WebServerId; webServerVersionId: string
  installedWebs: { id: string; port?: number }[]
  versionOptions: { id: string; label: string }[]
  wsVersionOptions: { id: string; label: string }[]
  loading: boolean
  submitLabel: string
  editing?: boolean
  onChangeName: (v: string) => void
  onChangeHostname: (v: string) => void
  onChangeRoot: (v: string) => void
  onChangeRuntime: (v: SiteRuntimeId) => void
  onChangeVersion: (v: string) => void
  onChangeWebServer: (v: WebServerId) => void
  onChangeWebServerVersion: (v: string) => void
  onPickRoot: () => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <FormField label="站点名称">
        <input value={name} onChange={(e) => onChangeName(e.target.value)}
          placeholder="如 myapp" className={formInputClass()} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Web 服务">
          <select value={webServer} onChange={(e) => onChangeWebServer(e.target.value as WebServerId)}
            disabled={editing || installedWebs.length === 0}
            className={formInputClass() + (editing ? ' opacity-60 cursor-not-allowed' : '')}>
            {installedWebs.length === 0 ? (
              <option value="">请先安装 Web 服务</option>
            ) : (
              WEB_SERVER_OPTIONS.filter((o) => installedWebs.some((c) => c.id === o.id)).map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))
            )}
          </select>
        </FormField>
        <FormField label="版本">
          <select value={webServerVersionId} onChange={(e) => onChangeWebServerVersion(e.target.value)}
            disabled={installedWebs.length === 0}
            className={formInputClass()}>
            {wsVersionOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="后端语言">
          <select value={runtime} onChange={(e) => onChangeRuntime(e.target.value as SiteRuntimeId)}
            disabled={editing}
            className={formInputClass() + (editing ? ' opacity-60 cursor-not-allowed' : '')}>
            {SITE_RUNTIME_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </FormField>
        {runtime !== 'static' ? (
          <FormField label="版本">
            <select value={runtimeVersionId} onChange={(e) => onChangeVersion(e.target.value)}
              className={formInputClass()}>
              {versionOptions.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </FormField>
        ) : <div />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="域名">
          <input value={hostname} onChange={(e) => onChangeHostname(e.target.value)}
            placeholder="名称.local" className={formInputClass() + ' font-mono'} />
        </FormField>
        <FormField label="网站目录">
          <div className="flex gap-2">
            <input value={root} onChange={(e) => onChangeRoot(e.target.value)}
              placeholder="www/myapp" className={formInputClass() + ' flex-1 font-mono'} />
            <Btn disabled={loading} onClick={onPickRoot}>浏览</Btn>
          </div>
        </FormField>
      </div>

      <div className="flex gap-2 pt-1">
        <Btn variant="primary" disabled={loading || !name.trim() || installedWebs.length === 0} onClick={onSubmit}>
          {submitLabel}
        </Btn>
        <Btn onClick={onCancel}>取消</Btn>
      </div>
    </div>
  )
}

/* ====== Websites View ====== */

export function WebsitesView({
  state,
  loading,
  onAdd,
  onDelete,
  onSetDefault,
  onOpen,
  onOpenRoot,
  onPickRoot,
  onStartSite,
  onStopSite,
  onUpdateSite,
}: {
  state: StackState
  loading: boolean
  onAdd: (params: AddSiteParams) => Promise<void>
  onDelete: (siteId: string) => Promise<void>
  onSetDefault: (siteId: string) => Promise<void>
  onOpen: (siteId: string) => void
  onOpenRoot: (siteId: string) => void
  onPickRoot: () => Promise<string | null>
  onStartSite: (siteId: string) => Promise<void>
  onStopSite: (siteId: string) => Promise<void>
  onUpdateSite: (params: UpdateSiteParams) => Promise<void>
}) {
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editHostname, setEditHostname] = useState('')
  const [editRoot, setEditRoot] = useState('')
  const [editRuntime, setEditRuntime] = useState<SiteRuntimeId>('php')
  const [editRuntimeVersionId, setEditRuntimeVersionId] = useState('')
  const [editWebServer, setEditWebServer] = useState<WebServerId>('nginx')
  const [editWebServerVersionId, setEditWebServerVersionId] = useState('')
  const [webServerVersionId, setWebServerVersionId] = useState('')

  const startEdit = (site: WebSiteView) => {
    setEditingSiteId(site.id)
    setEditName(site.name)
    setEditHostname(site.hostname)
    setEditRoot(site.root)
    setEditRuntime(site.runtime as SiteRuntimeId)
    setEditRuntimeVersionId(site.runtime_version_id ?? '')
    setEditWebServer(site.web_server as WebServerId)
  }
  const cancelEdit = () => setEditingSiteId(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [root, setRoot] = useState('')
  const [runtime, setRuntime] = useState<SiteRuntimeId>('php')
  const [runtimeVersionId, setRuntimeVersionId] = useState('')
  const installedWebs = useMemo(
    () => installedWebServers(state.components),
    [state.components],
  )
  const [webServer, setWebServer] = useState<WebServerId>('nginx')

  const versionOptions = useMemo(
    () => versionsForRuntime(state.components, runtime),
    [state.components, runtime],
  )
  const editVersionOptions = useMemo(
    () => versionsForRuntime(state.components, editRuntime),
    [state.components, editRuntime],
  )
  const wsVersionOptions = useMemo(
    () => webServerVersions(state.components, webServer),
    [state.components, webServer],
  )
  const editWsVersionOptions = useMemo(
    () => webServerVersions(state.components, editWebServer),
    [state.components, editWebServer],
  )

  useEffect(() => {
    if (runtime === 'static') { setRuntimeVersionId(''); return }
    setRuntimeVersionId(defaultVersionForRuntime(state.components, runtime))
  }, [runtime, state.components])

  useEffect(() => {
    if (installedWebs.length === 0) return
    if (!installedWebs.some((c) => c.id === webServer)) {
      setWebServer(installedWebs[0].id as WebServerId)
    }
  }, [installedWebs, webServer])

  const handleAdd = async () => {
    if (!name.trim() || installedWebs.length === 0) return
    await onAdd({
      name: name.trim(),
      hostname: hostname.trim() || undefined,
      root: root.trim() || undefined,
      runtime,
      runtime_version_id: runtime === 'static' ? undefined : runtimeVersionId || undefined,
      web_server: webServer,
    })
    setName(''); setHostname(''); setRoot(''); setRuntime('php')
    setRuntimeVersionId(defaultVersionForRuntime(state.components, 'php'))
    if (installedWebs[0]) setWebServer(installedWebs[0].id as WebServerId)
    setShowForm(false)
  }

  const runningCount = state.sites.filter(
    (s) => s.web_server_running || s.process_running
  ).length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-[var(--sb-border)]/50">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--sb-text)]">网站</h1>
          <p className="text-[11px] text-[var(--sb-muted)] mt-0.5">
            {state.sites.length > 0
              ? `${state.sites.length} 个站点 · ${runningCount} 个运行中`
              : '暂无站点'}
          </p>
        </div>
        <div className="flex-1" />
        <Btn variant="primary" disabled={loading || !state.install_root}
          onClick={() => setShowForm((v) => !v)}>
          {showForm ? '取消' : '添加站点'}
        </Btn>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* No install root */}
        {!state.install_root && (
          <div className="sb-row-card p-6 text-center">
            <IconGlobe size={28} className="mx-auto mb-3 text-[var(--sb-muted)]/40" />
            <p className="text-sm text-[var(--sb-text-secondary)] font-medium">请先在设置中配置环境根目录</p>
            <p className="text-[11px] text-[var(--sb-muted)] mt-1">安装根目录用于存放站点文件和配置</p>
          </div>
        )}

        {/* New site modal */}
        {showForm && state.install_root && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sb-border)]">
                <h2 className="text-[15px] font-bold text-[var(--sb-text)]">新建站点</h2>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] text-lg leading-none">×</button>
              </div>
              <div className="p-5">
                <SiteForm
                  name={name} hostname={hostname} root={root}
                  runtime={runtime} runtimeVersionId={runtimeVersionId}
                  webServer={webServer} webServerVersionId={webServerVersionId}
                  installedWebs={installedWebs}
                  versionOptions={versionOptions}
                  wsVersionOptions={wsVersionOptions}
                  loading={loading}
                  editing={false}
                  submitLabel="创建站点"
                  onChangeName={(v) => { setName(v); if (!hostname || hostname === `${name}.local`) setHostname(`${v}.local`) }}
                  onChangeHostname={setHostname}
                  onChangeRoot={setRoot}
                  onChangeRuntime={setRuntime}
                  onChangeVersion={setRuntimeVersionId}
                  onChangeWebServer={(v) => { setWebServer(v); setWebServerVersionId('') }}
                  onChangeWebServerVersion={setWebServerVersionId}
                  onPickRoot={async () => { const p = await onPickRoot(); if (p) setRoot(p) }}
                  onSubmit={handleAdd}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {state.sites.length === 0 && state.install_root && !showForm && (
          <div className="sb-row-card p-10 text-center">
            <IconGlobe size={36} className="mx-auto mb-4 text-[var(--sb-muted)]/25" />
            <p className="text-sm font-medium text-[var(--sb-text-secondary)]">暂无站点</p>
            <p className="text-[11px] text-[var(--sb-muted)] mt-1 mb-4">点击「添加站点」创建你的第一个网站</p>
            <Btn variant="primary" disabled={loading} onClick={() => setShowForm(true)}>
              添加站点
            </Btn>
          </div>
        )}

        {/* Site list */}
        {state.sites.length > 0 && (
          <div>
            <div className="grid grid-cols-[28px_28px_100px_minmax(0,1fr)_42px_minmax(0,1fr)_110px_90px_52px] gap-2 px-4 py-2 text-[10px] font-semibold text-[var(--sb-muted)] uppercase tracking-wider bg-[var(--sb-hover)] rounded-t-lg border border-b-0 border-[var(--sb-border)]">
              <div className="text-center">#</div>
              <div></div>
              <div>名称</div>
              <div>域名</div>
              <div className="text-center">端口</div>
              <div>路径</div>
              <div>Web 服务</div>
              <div>后端语言</div>
              <div className="text-center">设置</div>
            </div>
            <div className="border-x border-b border-[var(--sb-border)] rounded-b-lg">
            {/* Edit modal */}
            {editingSiteId && (() => {
              const site = state.sites.find((s) => s.id === editingSiteId)
              if (!site) return null
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={cancelEdit}>
                  <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sb-border)]">
                      <h2 className="text-[15px] font-bold text-[var(--sb-text)]">编辑站点 · {site.name}</h2>
                      <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] text-lg leading-none">×</button>
                    </div>
                    <div className="p-5">
                      <SiteForm
                        name={editName} hostname={editHostname} root={editRoot}
                        runtime={editRuntime} runtimeVersionId={editRuntimeVersionId}
                        webServer={editWebServer} webServerVersionId={editWebServerVersionId}
                        installedWebs={installedWebs}
                        versionOptions={editVersionOptions}
                        wsVersionOptions={editWsVersionOptions}
                        loading={loading}
                        editing={true}
                        submitLabel="保存修改"
                        onChangeName={setEditName}
                        onChangeHostname={setEditHostname}
                        onChangeRoot={setEditRoot}
                        onChangeRuntime={(r) => { setEditRuntime(r); setEditRuntimeVersionId('') }}
                        onChangeVersion={setEditRuntimeVersionId}
                        onChangeWebServer={(v) => { setEditWebServer(v); setEditWebServerVersionId('') }}
                        onChangeWebServerVersion={setEditWebServerVersionId}
                        onPickRoot={async () => { const p = await onPickRoot(); if (p) setEditRoot(p) }}
                        onSubmit={async () => {
                          await onUpdateSite({
                            site_id: site.id,
                            name: editName.trim() || undefined,
                            hostname: editHostname.trim() || undefined,
                            runtime: editRuntime !== site.runtime ? editRuntime : undefined,
                            runtime_version_id: editRuntime !== 'static' && editRuntimeVersionId !== site.runtime_version_id ? editRuntimeVersionId : undefined,
                            web_server: editWebServer !== site.web_server ? editWebServer : undefined,
                          })
                          cancelEdit()
                        }}
                        onCancel={cancelEdit}
                      />
                    </div>
                  </div>
                </div>
              )
            })()}

            {state.sites.map((site, i) => (
              editingSiteId !== site.id && (
                <SiteCard
                  key={site.id}
                  index={i + 1}
                  site={site}
                  loading={loading}
                  installedWebs={installedWebs}
                  onStartStop={() => {
                    if (isProcessRuntime(site.runtime)) {
                      site.process_running ? onStopSite(site.id) : onStartSite(site.id)
                    }
                  }}
                  onEdit={() => startEdit(site)}
                  onSetDefault={() => onSetDefault(site.id)}
                  onOpen={() => onOpen(site.id)}
                  onOpenRoot={() => onOpenRoot(site.id)}
                  onDelete={() => onDelete(site.id)}
                />
              )
            ))}
            </div>
          </div>
        )}

        {/* Warning footer */}
        {state.sites.some((s) => s.web_server_installed && !s.web_server_running) && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-[11px] text-amber-700 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>部分站点绑定的 Web 服务器未运行，请先在「软件包」中启动对应服务。</span>
          </div>
        )}
      </div>
    </div>
  )
}
