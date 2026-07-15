import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core'

export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && (isTauri() || '__TAURI_INTERNALS__' in window)
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnv()) {
    throw new Error('请使用 npm run tauri dev 启动桌面应用，不要在浏览器中直接打开 localhost')
  }
  return tauriInvoke<T>(cmd, args)
}
