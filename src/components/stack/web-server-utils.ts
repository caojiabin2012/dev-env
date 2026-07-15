import type { ComponentView } from '@/lib/stack-api'

const WEB_SERVER_IDS = ['nginx', 'openresty', 'caddy'] as const

export type WebServerId = (typeof WEB_SERVER_IDS)[number]

export const WEB_SERVER_OPTIONS: { id: WebServerId; label: string }[] = [
  { id: 'nginx', label: 'Nginx' },
  { id: 'openresty', label: 'OpenResty' },
  { id: 'caddy', label: 'Caddy' },
]

export function findRunningWebServer(components: ComponentView[]): ComponentView | undefined {
  for (const id of WEB_SERVER_IDS) {
    const comp = components.find((c) => c.id === id)
    if (comp?.status === 'running') return comp
  }
  return undefined
}

export function findPreferredWebServer(components: ComponentView[]): ComponentView | undefined {
  const running = findRunningWebServer(components)
  if (running) return running
  for (const id of WEB_SERVER_IDS) {
    const comp = components.find((c) => c.id === id && c.installed)
    if (comp) return comp
  }
  return undefined
}

export function installedWebServers(components: ComponentView[]): ComponentView[] {
  return WEB_SERVER_IDS.flatMap((id) => {
    const comp = components.find((c) => c.id === id && c.installed)
    return comp ? [comp] : []
  })
}

export function webServerOptionLabel(comp: ComponentView): string {
  return comp.name
}

export function webServerVersions(components: ComponentView[], webServer: string): { id: string; label: string }[] {
  const comp = components.find((c) => c.id === webServer)
  if (!comp?.installed) return []
  return comp.available_versions.filter((v) => v.id === comp.selected_version_id)
}
