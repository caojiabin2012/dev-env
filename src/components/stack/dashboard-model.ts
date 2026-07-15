export const DASHBOARD_CARD_ORDER = [
  'nginx',
  'openresty',
  'caddy',
  'php',
  'mysql',
  'mariadb',
  'redis',
  'rabbitmq',
  'rocketmq',
  'kafka',
] as const

export type DashboardCardId = (typeof DASHBOARD_CARD_ORDER)[number]

export const DEFAULT_DASHBOARD_CARDS: DashboardCardId[] = ['nginx', 'php', 'mysql', 'redis']

const ALLOWED = new Set<string>(DASHBOARD_CARD_ORDER)

export function normalizeDashboardCards(ids: string[] | undefined | null): DashboardCardId[] {
  const picked = (ids ?? DEFAULT_DASHBOARD_CARDS).filter((id): id is DashboardCardId =>
    ALLOWED.has(id),
  )
  const unique = [...new Set(picked)]
  return unique.length > 0 ? unique : [...DEFAULT_DASHBOARD_CARDS]
}

export function sortDashboardCards(ids: string[]): DashboardCardId[] {
  const set = new Set(ids)
  return DASHBOARD_CARD_ORDER.filter((id) => set.has(id))
}

export function dashboardCardsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = normalizeDashboardCards(a)
  const right = normalizeDashboardCards(b)
  if (left.length !== right.length) return false
  return left.every((id, i) => id === right[i])
}
