import zhCN from '@/locales/zh-CN.json'
import en from '@/locales/en.json'
import menuConfig from '@/config/menu.json'

export type LocaleId = 'zh-CN' | 'en'

const DICTS: Record<LocaleId, Record<string, string>> = {
  'zh-CN': zhCN,
  en,
}

const STORAGE_KEY = 'devenv.locale'

let currentLocale: LocaleId = loadStoredLocale()

function loadStoredLocale(): LocaleId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh-CN') return saved
  } catch {
    /* ignore */
  }
  return 'zh-CN'
}

export function getLocale(): LocaleId {
  return currentLocale
}

export function setLocale(locale: LocaleId) {
  currentLocale = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('devenv:locale-change', { detail: locale }))
}

export function t(key: string, fallback?: string): string {
  return DICTS[currentLocale][key] ?? DICTS['zh-CN'][key] ?? fallback ?? key
}

export interface MenuItemConfig {
  id: string
  labelKey: string
  icon?: string
}

export interface MenuSectionConfig {
  id: string
  titleKey: string
  items: MenuItemConfig[]
}

export interface MenuConfig {
  primaryNav: MenuItemConfig[]
  sections: MenuSectionConfig[]
  footerNav: MenuItemConfig[]
}

export function getMenuConfig(): MenuConfig {
  return menuConfig as MenuConfig
}

export function resolveMenuSections(): { title: string; items: { id: string; label: string }[] }[] {
  return getMenuConfig().sections.map((section) => ({
    title: t(section.titleKey),
    items: section.items.map((item) => ({
      id: item.id,
      label: t(item.labelKey),
    })),
  }))
}
