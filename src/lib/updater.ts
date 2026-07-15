import { getVersion } from '@tauri-apps/api/app'

export interface UpdateInfo {
  currentVersion: string
  availableVersion: string
  notes?: string
  pubDate?: string
}

export async function checkForUpdate(
  _opts: { timeout?: number } = {},
): Promise<{ status: 'up-to-date' } | { status: 'available'; info: UpdateInfo }> {
  await getVersion()
  return { status: 'up-to-date' }
}
