import type { ComponentView } from '@/lib/stack-api'
import { getMenuConfig, resolveMenuSections, t } from '@/lib/i18n'
import { PKG_META } from './icons'

export type MiddleNavId = string

/** 侧栏分组：从 menu.json + 当前语言解析 */
export function getMiddleSections(): {
  title: string
  items: { id: MiddleNavId; label: string }[]
}[] {
  return resolveMenuSections()
}

/** @deprecated 请用 getMiddleSections()，保留兼容旧引用 */
export const MIDDLE_SECTIONS = getMiddleSections()

export const PATH_ENV_COMPONENT_IDS = [
  'nginx', 'openresty', 'caddy', 'php',
  'composer', 'python', 'pip', 'go', 'java', 'node',
  'mysql', 'mariadb', 'redis', 'rabbitmq',
  'rocketmq', 'kafka',
] as const

export function supportsPathEnv(componentId: string): boolean {
  return (PATH_ENV_COMPONENT_IDS as readonly string[]).includes(componentId)
}

export const CLI_TOOL_IDS = ['composer', 'python', 'pip', 'go', 'java', 'node', 'npm'] as const
export type CliToolId = (typeof CLI_TOOL_IDS)[number]
export const MANUAL_COMPONENT_IDS = ['kafka'] as const

export const CLI_TOOL_DEPS: Partial<Record<CliToolId, string>> = {
  composer: 'php',
  pip: 'python',
  npm: 'node',
}

export function isCliTool(componentId: string): componentId is CliToolId {
  return (CLI_TOOL_IDS as readonly string[]).includes(componentId)
}

export function isManualManagedComponent(componentId: string): boolean {
  return (MANUAL_COMPONENT_IDS as readonly string[]).includes(componentId)
}

export const PORT_CONFIG_COMPONENT_IDS = [
  'mysql', 'mariadb', 'nginx', 'openresty', 'caddy', 'php', 'redis', 'rabbitmq',
] as const

export function supportsPortConfig(componentId: string): boolean {
  return (PORT_CONFIG_COMPONENT_IDS as readonly string[]).includes(componentId)
}

export function allMenuComponentIds(): string[] {
  return getMenuConfig().sections.flatMap((s) => s.items.map((i) => i.id))
}

export interface VersionRow {
  componentId: string
  versionId: string
  packageName: string
  versionNumber: string
  installed: boolean
  downloaded: boolean
  isActive: boolean
  status: ComponentView['status']
  pid: number | null
  port: number | null
  defaultPort: number
  hasUpdate: boolean
  component: ComponentView
}

function shortVersion(label: string): string {
  const m = label.match(/(\d+\.\d+(?:\.\d+)?(?:\w+)?)/)
  return m?.[1] ?? label
}

function packageDisplayName(componentId: string, versionLabel: string): string {
  const base = PKG_META[componentId]?.label ?? componentId
  const ver = shortVersion(versionLabel)
  if (componentId === 'php') return `PHP ${ver.split('.')[0]}.${ver.split('.')[1] ?? ''}`.replace(/\.$/, '')
  if (componentId === 'composer') return `Composer ${ver}`
  if (componentId === 'python') return `Python ${ver.split('.').slice(0, 2).join('.')}`
  if (componentId === 'pip') return `pip ${ver}`
  if (componentId === 'go') return `Go ${ver.split('.').slice(0, 2).join('.')}`
  if (componentId === 'java') return `Java ${ver.split('.').slice(0, 2).join('.')}`
  if (componentId === 'node') return `Node.js ${ver.split('.')[0]}`
  if (componentId === 'npm') return versionLabel.includes('npm') ? versionLabel : `npm ${ver}`
  if (componentId === 'mysql') return `MySQL ${ver.split('.').slice(0, 2).join('.')}`
  if (componentId === 'mariadb') return `MariaDB ${ver.split('.').slice(0, 2).join('.')}`
  if (componentId === 'nginx') return `Nginx ${ver}`
  if (componentId === 'openresty') return `OpenResty ${ver}`
  if (componentId === 'redis') return `Redis ${ver}`
  if (componentId === 'rabbitmq') return `RabbitMQ ${ver}`
  return `${base} ${ver}`
}

export function buildVersionRows(components: ComponentView[], filterId: MiddleNavId | null): VersionRow[] {
  const list = filterId ? components.filter((c) => c.id === filterId) : components
  const rows: VersionRow[] = []
  for (const comp of list) {
    const minorLatest = new Map<string, (typeof comp.available_versions)[number]>()
    for (const v of comp.available_versions) {
      const minor = shortVersion(v.label).split('.').slice(0, 2).join('.')
      if (!minorLatest.has(minor)) minorLatest.set(minor, v)
    }

    const installedVers = comp.available_versions.filter((v) => v.installed)
    const activeVer =
      installedVers.find((v) => v.id === comp.selected_version_id || v.is_active)
      ?? (comp.installed
        ? comp.available_versions.find((v) => v.id === comp.selected_version_id)
        : undefined)

    const shown = new Set<string>()
    for (const [minor, latest] of minorLatest) {
      const sameMinorInstalled = installedVers.find(
        (iv) => shortVersion(iv.label).split('.').slice(0, 2).join('.') === minor,
      )
      const isActive = Boolean(activeVer && activeVer.id === latest.id)
      const hasUpdate =
        sameMinorInstalled != null &&
        sameMinorInstalled.id !== latest.id

      if (hasUpdate && sameMinorInstalled) {
        rows.push(makeRow(comp, sameMinorInstalled, true, false))
        shown.add(sameMinorInstalled.id)
        rows.push(makeRow(comp, latest, false, true))
        shown.add(latest.id)
      } else {
        rows.push(makeRow(comp, latest, isActive, false))
        shown.add(latest.id)
      }
    }

    for (const iv of installedVers) {
      if (!shown.has(iv.id)) {
        rows.push(makeRow(comp, iv, iv.id === activeVer?.id, false))
      }
    }
  }
  return rows
}

function makeRow(
  comp: ComponentView,
  v: ComponentView['available_versions'][number],
  isActive: boolean,
  hasUpdate: boolean,
): VersionRow {
  const installed = Boolean(v.installed || isActive)
  const rememberedPort = v.port ?? null
  return {
    componentId: comp.id,
    versionId: v.id,
    packageName: packageDisplayName(comp.id, v.label),
    versionNumber: shortVersion(v.label),
    installed,
    downloaded: Boolean(v.downloaded || installed),
    isActive,
    status: isActive ? comp.status : installed ? 'stopped' : 'not_installed',
    pid: isActive ? comp.pid : null,
    port: isActive ? comp.port : rememberedPort,
    defaultPort: comp.default_port,
    hasUpdate,
    component: comp,
  }
}

export { t }
