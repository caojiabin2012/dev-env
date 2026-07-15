import { type ReactNode, useMemo } from 'react'
import type { ComponentView } from '@/lib/stack-api'
import { t } from '@/lib/i18n'
import { IconDashboard, IconGlobe, IconSettings, IconPlay, IconStop } from './icons'
import { AppLogo } from './app-logo'

export type PrimaryNavId = 'dashboard' | 'websites' | 'packages' | 'settings'

export interface CategorySection {
  title: string
  items: { id: string; label: string }[]
}

function Dot({ comp }: { comp?: ComponentView }) {
  if (!comp) return <span className="h-2 w-2 rounded-full bg-zinc-300 shrink-0" />
  if (comp.status === 'running')
    return <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)] shrink-0" />
  if (comp.installed)
    return <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
  return <span className="h-2 w-2 rounded-full bg-zinc-300 shrink-0" />
}

export function Sidebar({
  primaryNav,
  onPrimaryNav,
  middleNav,
  onMiddleNav,
  sections,
  components,
  onStartAll,
  onStopAll,
}: {
  primaryNav: PrimaryNavId
  onPrimaryNav: (id: PrimaryNavId) => void
  middleNav: string
  onMiddleNav: (id: string) => void
  sections: CategorySection[]
  components: ComponentView[]
  onStartAll: (ids: string[]) => void
  onStopAll: (ids: string[]) => void
}) {
  const compMap = new Map(components.map((c) => [c.id, c]))
  const labels = useMemo(() => ({
    name: t('app.name'),
    tagline: t('app.tagline'),
    dashboard: t('nav.dashboard'),
    websites: t('nav.websites'),
    settings: t('nav.settings'),
    startAll: t('action.startAll'),
    stopAll: t('action.stopAll'),
  }), [sections])

  return (
    <aside className="w-[220px] shrink-0 border-r border-[var(--sb-border)] bg-[var(--sb-sidebar-bg)] flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <AppLogo size={32} className="rounded-lg shadow-sm shrink-0" />
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-[var(--sb-text)]">{labels.name}</div>
          <div className="text-[10px] text-[var(--sb-muted)]">{labels.tagline}</div>
        </div>
      </div>

      {/* 主导航 */}
      <nav className="px-3 py-1">
        <NavItem id="dashboard" icon={IconDashboard} label={labels.dashboard} active={primaryNav} onClick={onPrimaryNav} />
        <NavItem id="websites" icon={IconGlobe} label={labels.websites} active={primaryNav} onClick={onPrimaryNav} />
      </nav>

      {/* 软件分类 — 始终展示 */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {sections.map((section) => {
          const secIds = section.items.map((i) => i.id)
          const running = secIds.filter((id) => compMap.get(id)?.status === 'running').length
          const total = secIds.filter((id) => compMap.get(id)?.installed).length
          return (
            <div key={section.title} className="mb-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[10px] font-semibold text-[var(--sb-muted)] uppercase tracking-wider">
                  {section.title}
                  {total > 0 && <span className="ml-1.5 font-normal opacity-60">{running}/{total}</span>}
                </span>
                <div className="flex gap-0.5">
                  <button title={labels.startAll} onClick={() => onStartAll(secIds)}
                    className="p-0.5 rounded text-[var(--sb-muted)] hover:text-emerald-500">
                    <IconPlay size={11} />
                  </button>
                  <button title={labels.stopAll} onClick={() => onStopAll(secIds)}
                    className="p-0.5 rounded text-[var(--sb-muted)] hover:text-amber-500">
                    <IconStop size={11} />
                  </button>
                </div>
              </div>
              {section.items.map((item) => {
                  const isActive = primaryNav === 'packages' && middleNav === item.id
                  const comp = compMap.get(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { onPrimaryNav('packages'); onMiddleNav(item.id) }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-[var(--sb-accent-soft)] text-[var(--sb-accent)] font-medium'
                          : 'text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)]'
                      }`}
                    >
                      <Dot comp={comp} />
                      <span className="flex-1 text-[12px] truncate">{item.label}</span>
                      {comp?.port != null && comp.installed && (
                        <span className="text-[10px] text-[var(--sb-muted)] font-mono shrink-0">:{comp.port}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

      {/* 底部 */}
      <div className="px-3 pb-3 pt-2 border-t border-[var(--sb-border)]/50">
        <NavItem id="settings" icon={IconSettings} label={labels.settings} active={primaryNav} onClick={onPrimaryNav} />
      </div>
    </aside>
  )
}

function NavItem({ id, icon: Icon, label, active, onClick }: {
  id: PrimaryNavId
  icon: typeof IconDashboard
  label: string
  active: PrimaryNavId
  onClick: (id: PrimaryNavId) => void
}) {
  const isActive = active === id
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
        isActive
          ? 'bg-[var(--sb-accent-soft)] text-[var(--sb-accent)] font-medium'
          : 'text-[var(--sb-text-secondary)] hover:bg-[var(--sb-hover)]'
      }`}
    >
      <Icon size={17} strokeWidth={isActive ? 2 : 1.6} />
      <span className="flex-1 text-[12px] truncate">{label}</span>
    </button>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h1 className="text-[22px] font-semibold tracking-tight text-[var(--sb-text)]">{children}</h1>
      {action}
    </div>
  )
}
