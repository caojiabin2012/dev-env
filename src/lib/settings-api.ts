import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  auto_start: boolean;
  close_to_tray: boolean;
  shortcuts: Record<string, string>;
}

export async function getSettings(): Promise<AppSettings> {
  return invoke('get_settings');
}

export async function saveSettings(
  autoStart: boolean,
  closeToTray: boolean,
  shortcuts: Record<string, string>,
): Promise<AppSettings> {
  return invoke('save_settings', { autoStart, closeToTray, shortcuts });
}

export async function updateShortcuts(
  shortcuts: Record<string, string>,
): Promise<void> {
  return invoke('update_shortcuts', { shortcuts });
}

export async function getAppVersion(): Promise<string> {
  return invoke('get_app_version');
}

export async function installUpdateAndRestart(): Promise<boolean> {
  return invoke('install_update_and_restart');
}
