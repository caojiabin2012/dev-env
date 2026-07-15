import { useEffect, useState } from 'react'
import type { ComponentView, DbEngine, DbInfo } from '@/lib/stack-api'
import { dbListDatabases, dbListTables, dbSetRootPassword, dbImport, dbExport, dbCreateDatabase, dbPickSqlFile, dbPickExportDir } from '@/lib/stack-api'
import { Btn } from './ui'

export function DatabaseManager({ comp, onClose }: { comp: ComponentView; onClose: () => void }) {
  const engine: DbEngine = comp.id === 'mariadb' ? 'mariadb' : 'mysql'
  const [dbs, setDbs] = useState<DbInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Password
  const [showPwd, setShowPwd] = useState(false)
  const [password, setPassword] = useState('')

  // Create DB
  const [showCreate, setShowCreate] = useState(false)
  const [newDbName, setNewDbName] = useState('')
  const [newDbCharset, setNewDbCharset] = useState('utf8mb4')
  const [newDbCollation, setNewDbCollation] = useState('utf8mb4_general_ci')

  // Import (per-database, pre-filled)
  const [importTarget, setImportTarget] = useState<{ db: string; file: string } | null>(null)
  const [importFile, setImportFile] = useState('')

  // Export (per-database)
  const [exportTarget, setExportTarget] = useState<string | null>(null)
  const [exportTables, setExportTables] = useState<string[]>([])
  const [exportAllTables, setExportAllTables] = useState(true)
  const [allTables, setAllTables] = useState<string[]>([])
  const [exportPath, setExportPath] = useState('')
  const [exportGzip, setExportGzip] = useState(false)

  // auto-generate export filename: {db}_{YYYYMMDD_HHmmss}.sql
  const exportFileName = exportTarget
    ? `${exportTarget}_${new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)}.sql`
    : ''

  const refresh = async () => {
    if (!comp.installed || comp.status !== 'running') return
    setLoading(true)
    setError(null)
    try {
      setDbs(await dbListDatabases(engine))
    } catch (e) {
      setError(String(e))
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [comp.status])
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t) } }, [msg])

  const handleCreateDb = async () => {
    if (!newDbName.trim()) return
    setLoading(true)
    try {
      await dbCreateDatabase(engine, newDbName.trim(), newDbCharset, newDbCollation)
      setMsg(`数据库 ${newDbName} 已创建`)
      setShowCreate(false)
      setNewDbName('')
      refresh()
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  const handleSetPassword = async () => {
    if (!password.trim()) return
    setLoading(true)
    try {
      await dbSetRootPassword(engine, password)
      setMsg('root 密码已设置')
      setShowPwd(false)
      setPassword('')
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  const handleImport = async () => {
    if (!importTarget || !importFile.trim()) return
    setLoading(true)
    try {
      await dbImport(engine, importTarget.db, importFile.trim())
      setMsg(`已导入到 ${importTarget.db}`)
      setImportTarget(null)
      refresh()
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  const handleExport = async () => {
    if (!exportTarget || !exportPath.trim()) return
    setLoading(true)
    try {
      const outDir = exportPath.trim().replace(/\\/g, '/').replace(/\/$/, '')
      const fullPath = `${outDir}/${exportFileName}`
      await dbExport(engine, exportTarget, fullPath, exportAllTables ? [] : exportTables, exportGzip)
      setMsg(`已导出到 ${fullPath}`)
      setExportTarget(null)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  const openExport = async (db: string) => {
    setExportTarget(db)
    setExportAllTables(true)
    setExportTables([])
    setExportPath('')
    setExportGzip(false)
    try { setAllTables(await dbListTables(engine, db)) } catch { setAllTables([]) }
  }

  const openImport = (db: string) => {
    setImportTarget({ db, file: '' })
    setImportFile('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sb-border)]">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--sb-text)]">{comp.name} 数据库管理</h2>
            <p className="text-[11px] text-[var(--sb-muted)]">{comp.hint}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] text-lg leading-none">×</button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[var(--sb-border)]/50">
          <Btn size="sm" onClick={refresh} disabled={loading || comp.status !== 'running'}>刷新</Btn>
          <Btn size="sm" onClick={() => setShowCreate(true)}>创建数据库</Btn>
          <Btn size="sm" onClick={() => setShowPwd(true)}>设置 root 密码</Btn>
          <div className="flex-1" />
        </div>
        {(msg || error) && (
          <div className={`px-5 py-1.5 text-[11px] font-medium border-b border-[var(--sb-border)]/30 ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {error || msg}
          </div>
        )}

        {/* DB List */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {comp.status !== 'running' ? (
            <div className="py-16 text-center text-sm text-[var(--sb-muted)]">数据库未运行，请先启动 {comp.name}</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[var(--sb-muted)] border-b border-[var(--sb-border)]">
                  <th className="py-2 font-medium">数据库</th>
                  <th className="py-2 font-medium">编码</th>
                  <th className="py-2 font-medium">排序规则</th>
                  <th className="py-2 font-medium text-center">表</th>
                  <th className="py-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {dbs.map((db) => (
                  <tr key={db.name} className="border-b border-[var(--sb-border)]/30 hover:bg-[var(--sb-hover)]">
                    <td className="py-2 font-mono font-medium text-[var(--sb-text)]">{db.name}</td>
                    <td className="py-2 text-[var(--sb-muted)]">{db.charset}</td>
                    <td className="py-2 text-[var(--sb-muted)] text-[11px]">{db.collation}</td>
                    <td className="py-2 text-center tabular-nums">{db.table_count}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Btn size="sm" variant="ghost" onClick={() => openImport(db.name)}>导入</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => openExport(db.name)}>导出</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {dbs.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-12 text-center text-[var(--sb-muted)]">暂无数据库，点击「创建数据库」</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Create DB Modal */}
        {showCreate && (
          <ModalLayer onClose={() => setShowCreate(false)}>
            <div className="bg-white rounded-xl shadow-xl p-5 w-[380px] space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-[var(--sb-text)]">创建数据库</div>
              <label className="block space-y-1">
                <span className="text-[11px] text-[var(--sb-muted)]">数据库名称</span>
                <input value={newDbName} onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="如 myapp" className="w-full rounded-lg border border-[var(--sb-border)] px-3 py-2 text-sm font-mono" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[11px] text-[var(--sb-muted)]">编码</span>
                  <select value={newDbCharset} onChange={(e) => setNewDbCharset(e.target.value)}
                    className="w-full rounded-lg border border-[var(--sb-border)] px-3 py-2 text-sm">
                    <option value="utf8mb4">utf8mb4</option>
                    <option value="utf8">utf8</option>
                    <option value="latin1">latin1</option>
                    <option value="gbk">gbk</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] text-[var(--sb-muted)]">排序规则</span>
                  <select value={newDbCollation} onChange={(e) => setNewDbCollation(e.target.value)}
                    className="w-full rounded-lg border border-[var(--sb-border)] px-3 py-2 text-sm">
                    <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                    <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                    <option value="utf8_general_ci">utf8_general_ci</option>
                  </select>
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <Btn onClick={() => setShowCreate(false)}>取消</Btn>
                <Btn variant="primary" disabled={!newDbName.trim()} onClick={handleCreateDb}>创建</Btn>
              </div>
            </div>
          </ModalLayer>
        )}

        {/* Set Password Modal */}
        {showPwd && (
          <ModalLayer onClose={() => setShowPwd(false)}>
            <div className="bg-white rounded-xl shadow-xl p-5 w-[360px] space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-[var(--sb-text)]">设置 root 密码</div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="输入新密码" className="w-full rounded-lg border border-[var(--sb-border)] px-3 py-2 text-sm" />
              <div className="flex gap-2 justify-end">
                <Btn onClick={() => setShowPwd(false)}>取消</Btn>
                <Btn variant="primary" disabled={!password.trim()} onClick={handleSetPassword}>确认</Btn>
              </div>
            </div>
          </ModalLayer>
        )}

        {/* Import Modal (per-database) */}
        {importTarget && (
          <ModalLayer onClose={() => setImportTarget(null)}>
            <div className="bg-white rounded-xl shadow-xl p-5 w-[420px] space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-[var(--sb-text)]">导入到 {importTarget.db}</div>
              <label className="block space-y-1">
                <span className="text-[11px] text-[var(--sb-muted)]">SQL 文件路径</span>
                <div className="flex gap-2">
                  <input value={importFile} onChange={(e) => setImportFile(e.target.value)}
                    placeholder="如 D:\backup\dump.sql" className="flex-1 rounded-lg border border-[var(--sb-border)] px-3 py-2 text-sm font-mono" />
                  <Btn onClick={async () => { const p = await dbPickSqlFile(); if (p) setImportFile(p) }}>浏览</Btn>
                </div>
              </label>
              <div className="flex gap-2 justify-end">
                <Btn onClick={() => setImportTarget(null)}>取消</Btn>
                <Btn variant="primary" disabled={!importFile.trim()} onClick={handleImport}>导入</Btn>
              </div>
            </div>
          </ModalLayer>
        )}

        {/* Export Modal (per-database) */}
        {exportTarget && (
          <ModalLayer onClose={() => setExportTarget(null)}>
            <div className="bg-white rounded-xl shadow-xl p-5 w-[460px] space-y-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-[var(--sb-text)]">导出 {exportTarget}</div>

              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={exportAllTables} onChange={(e) => setExportAllTables(e.target.checked)} />
                导出所有表
              </label>

              {!exportAllTables && allTables.length > 0 && (
                <div className="max-h-[160px] overflow-y-auto border border-[var(--sb-border)] rounded-lg p-2 space-y-1">
                  {allTables.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input type="checkbox" checked={exportTables.includes(t)}
                        onChange={(e) => {
                          if (e.target.checked) setExportTables([...exportTables, t])
                          else setExportTables(exportTables.filter((x) => x !== t))
                        }} />
                      {t}
                    </label>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={exportGzip} onChange={(e) => setExportGzip(e.target.checked)} />
                压缩导出
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] text-[var(--sb-muted)]">导出目录</span>
                <div className="flex gap-2">
                  <input value={exportPath} onChange={(e) => setExportPath(e.target.value)}
                    placeholder="选择目录或输入路径" className="flex-1 rounded-lg border border-[var(--sb-border)] px-3 py-2 text-sm font-mono" />
                  <Btn onClick={async () => { const p = await dbPickExportDir(); if (p) setExportPath(p) }}>浏览</Btn>
                </div>
                {exportPath && (
                  <p className="text-[10px] text-[var(--sb-muted)] mt-1">
                    文件名：<code className="font-mono text-[var(--sb-accent)]">{exportFileName}</code>
                  </p>
                )}
              </label>

              <div className="flex gap-2 justify-end">
                <Btn onClick={() => setExportTarget(null)}>取消</Btn>
                <Btn variant="primary" disabled={!exportPath.trim()} onClick={handleExport}>导出</Btn>
              </div>
            </div>
          </ModalLayer>
        )}
      </div>
    </div>
  )
}

function ModalLayer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={onClose}>
      {children}
    </div>
  )
}
