const SHANGHAI = 'Asia/Shanghai'

/** 格式化为 YYYY-MM-DD HH:mm:ss（上海时区） */
export function formatDateTimeShanghai(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: SHANGHAI })
}

/** 解析 YYYY-MM-DD HH:mm:ss，按上海时区理解 */
export function parseDateTimeShanghai(input: string): Date | null {
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}
