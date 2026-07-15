import { useEffect, useState, type ReactNode } from 'react'

export function Btn({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  size = 'md',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  className?: string
}) {
  const sizes = { sm: 'h-7 px-2.5 text-[11px] gap-1', md: 'h-8 px-3.5 text-[12px] gap-1.5' }
  const variants = {
    primary: 'bg-[var(--sb-accent)] text-white shadow-sm',
    secondary: 'bg-white text-[var(--sb-text)] border border-[var(--sb-border)] shadow-sm',
    ghost: 'text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)]',
    danger: 'text-red-500 hover:bg-red-50',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function IconBtn({
  title,
  onClick,
  disabled,
  children,
  active,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-35 ${
        active
          ? 'bg-[var(--env-brand)]/10 text-[var(--env-brand)]'
          : 'text-muted-foreground hover:bg-[var(--env-surface-hover)] hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

export function StatusPill({ status }: { status: 'not_installed' | 'stopped' | 'running' | 'error' | 'downloading' }) {
  const map = {
    not_installed: { label: '未安装', cls: 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20' },
    stopped: { label: '已停止', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20' },
    running: { label: '运行中', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' },
    error: { label: '异常', cls: 'bg-red-500/10 text-red-600 ring-red-500/20' },
    downloading: { label: '下载中', cls: 'bg-blue-500/10 text-blue-600 ring-blue-500/20' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.cls}`}>
      {(status === 'running' || status === 'downloading') && (
        <span className={`h-1.5 w-1.5 rounded-full ${status === 'running' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
      )}
      {s.label}
    </span>
  )
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="env-panel px-4 py-3 min-w-[120px]">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${accent ?? 'text-foreground'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`env-panel overflow-hidden ${className}`}>{children}</div>
}

export function Toast({
  type,
  message,
  onClose,
  duration = 3200,
}: {
  type: 'success' | 'error'
  message: string
  onClose: () => void
  duration?: number
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
    // onClose 每次渲染都是新引用，只在 message 变化或首次挂载时启动 timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, duration])

  const isError = type === 'error'

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white border border-[var(--sb-border)] shadow-[0_10px_40px_rgba(15,23,42,0.14)] animate-fade-in min-w-[280px] max-w-sm overflow-hidden"
    >
      <div className={`w-1 self-stretch shrink-0 ${isError ? 'bg-red-500' : 'bg-emerald-500'}`} />
      <div
        className={`my-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold ${
          isError ? 'bg-red-500' : 'bg-emerald-500'
        }`}
      >
        {isError ? '✕' : '✓'}
      </div>
      <p className="flex-1 py-3 text-[13px] font-medium text-[var(--sb-text)] leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="mr-3 shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onCancel}
    >
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      {/* 对话框 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] ring-1 ring-black/5 animate-fade-in"
      >
        <div className="p-6">
          <h3 className="text-[15px] font-semibold text-[var(--sb-text)]">{title}</h3>
          <p className="mt-2 text-[13px] text-[var(--sb-text-secondary)] leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-[var(--sb-border)] bg-white text-[13px] font-medium text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 h-9 rounded-lg text-[13px] font-medium text-white transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[var(--sb-accent)] hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PortField({
  value,
  disabled,
  loading,
  title,
  onSave,
}: {
  value: number
  disabled?: boolean
  loading?: boolean
  title?: string
  onSave: (port: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    const next = Number.parseInt(draft, 10)
    if (!Number.isFinite(next) || next < 1 || next > 65535) {
      setDraft(String(value))
      return
    }
    if (next !== value) onSave(next)
  }

  if (disabled) {
    return (
      <span className="text-[12px] font-mono text-[var(--sb-muted)] tabular-nums" title={title ?? '请先停止服务再修改端口'}>
        {value}
      </span>
    )
  }

  return (
    <input
      type="number"
      min={1}
      max={65535}
      value={draft}
      disabled={loading}
      title={title ?? '修改端口，回车或失焦保存'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(String(value))
          e.currentTarget.blur()
        }
      }}
      className="w-[76px] h-7 rounded-md border border-[var(--sb-border)] bg-white px-2 text-[12px] font-mono text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--sb-accent)]/25 disabled:opacity-40"
    />
  )
}
