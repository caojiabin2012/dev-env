import type { ComponentView, SiteRuntimeId } from '@/lib/stack-api'
import { SITE_RUNTIME_OPTIONS } from '@/lib/stack-api'

const RUNTIME_TONE: Record<SiteRuntimeId, string> = {
  php: 'bg-indigo-500/10 text-indigo-700 ring-indigo-500/20',
  python: 'bg-sky-500/10 text-sky-700 ring-sky-500/20',
  go: 'bg-cyan-500/10 text-cyan-700 ring-cyan-500/20',
  node: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
  static: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/20',
}

export function runtimeBadgeClass(runtime: string): string {
  return RUNTIME_TONE[runtime as SiteRuntimeId] ?? RUNTIME_TONE.static
}

export function versionsForRuntime(
  components: ComponentView[],
  runtime: SiteRuntimeId,
): { id: string; label: string }[] {
  if (runtime === 'static') return []
  const opt = SITE_RUNTIME_OPTIONS.find((o) => o.id === runtime)
  if (!opt?.componentId) return []
  const comp = components.find((c) => c.id === opt.componentId)
  if (!comp?.installed) return []
  return comp.available_versions
}

/** 需要独立进程启动的运行时 */
const PROCESS_RUNTIMES = new Set<SiteRuntimeId>(['go', 'python', 'node'])

export function isProcessRuntime(runtime: string): boolean {
  return PROCESS_RUNTIMES.has(runtime as SiteRuntimeId)
}

export function defaultVersionForRuntime(
  components: ComponentView[],
  runtime: SiteRuntimeId,
): string {
  const versions = versionsForRuntime(components, runtime)
  if (versions.length === 0) return ''
  const comp = components.find(
    (c) => c.id === SITE_RUNTIME_OPTIONS.find((o) => o.id === runtime)?.componentId,
  )
  const selected = comp?.selected_version_id
  if (selected && versions.some((v) => v.id === selected)) return selected
  return versions[0]?.id ?? ''
}
