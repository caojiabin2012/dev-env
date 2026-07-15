// 日历备忘录和提醒存储
// 使用 localStorage 持久化数据

export interface CalendarMemo {
  id: string
  date: string // YYYY-MM-DD 格式
  title: string
  content: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface CalendarReminder {
  id: string
  date: string // YYYY-MM-DD 格式
  time: string // HH:mm 格式
  title: string
  content: string
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  enabled: boolean
  createdAt: number
  lastTriggered?: number
}

const MEMO_KEY = 'calendar-memos'
const REMINDER_KEY = 'calendar-reminders'

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// 备忘录操作
export function getMemos(date?: string): CalendarMemo[] {
  try {
    const data = localStorage.getItem(MEMO_KEY)
    const memos: CalendarMemo[] = data ? JSON.parse(data) : []
    if (date) {
      return memos.filter((m) => m.date === date)
    }
    return memos
  } catch {
    return []
  }
}

export function getMemoById(id: string): CalendarMemo | null {
  const memos = getMemos()
  return memos.find((m) => m.id === id) || null
}

export function addMemo(memo: Omit<CalendarMemo, 'id' | 'createdAt' | 'updatedAt'>): CalendarMemo {
  const memos = getMemos()
  const newMemo: CalendarMemo = {
    ...memo,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  memos.push(newMemo)
  localStorage.setItem(MEMO_KEY, JSON.stringify(memos))
  return newMemo
}

export function updateMemo(id: string, updates: Partial<CalendarMemo>): CalendarMemo | null {
  const memos = getMemos()
  const index = memos.findIndex((m) => m.id === id)
  if (index === -1) return null
  memos[index] = { ...memos[index], ...updates, updatedAt: Date.now() }
  localStorage.setItem(MEMO_KEY, JSON.stringify(memos))
  return memos[index]
}

export function deleteMemo(id: string): boolean {
  const memos = getMemos()
  const filtered = memos.filter((m) => m.id !== id)
  if (filtered.length === memos.length) return false
  localStorage.setItem(MEMO_KEY, JSON.stringify(filtered))
  return true
}

export function getMemosByMonth(year: number, month: number): CalendarMemo[] {
  const memos = getMemos()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return memos.filter((m) => m.date.startsWith(prefix))
}

// 提醒操作
export function getReminders(date?: string): CalendarReminder[] {
  try {
    const data = localStorage.getItem(REMINDER_KEY)
    const reminders: CalendarReminder[] = data ? JSON.parse(data) : []
    if (date) {
      return reminders.filter((r) => r.date === date && r.enabled)
    }
    return reminders
  } catch {
    return []
  }
}

export function getAllReminders(): CalendarReminder[] {
  try {
    const data = localStorage.getItem(REMINDER_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function getReminderById(id: string): CalendarReminder | null {
  const reminders = getAllReminders()
  return reminders.find((r) => r.id === id) || null
}

export function addReminder(reminder: Omit<CalendarReminder, 'id' | 'createdAt'>): CalendarReminder {
  const reminders = getAllReminders()
  const newReminder: CalendarReminder = {
    ...reminder,
    id: generateId(),
    createdAt: Date.now(),
  }
  reminders.push(newReminder)
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders))
  return newReminder
}

export function updateReminder(id: string, updates: Partial<CalendarReminder>): CalendarReminder | null {
  const reminders = getAllReminders()
  const index = reminders.findIndex((r) => r.id === id)
  if (index === -1) return null
  reminders[index] = { ...reminders[index], ...updates }
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders))
  return reminders[index]
}

export function deleteReminder(id: string): boolean {
  const reminders = getAllReminders()
  const filtered = reminders.filter((r) => r.id !== id)
  if (filtered.length === reminders.length) return false
  localStorage.setItem(REMINDER_KEY, JSON.stringify(filtered))
  return true
}

export function getUpcomingReminders(): CalendarReminder[] {
  const now = new Date()
  const reminders = getAllReminders()
  return reminders
    .filter((r) => r.enabled)
    .filter((r) => {
      const reminderDate = new Date(`${r.date}T${r.time}`)
      return reminderDate > now
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 10)
}

// 检查并触发提醒
export function checkReminders(): CalendarReminder[] {
  const now = new Date()
  const currentHour = now.getHours()
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentTime = `${String(currentHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const reminders = getAllReminders()
  const triggered: CalendarReminder[] = []

  for (const reminder of reminders) {
    if (!reminder.enabled) continue
    if (reminder.date !== currentDate) continue
    if (reminder.time !== currentTime) continue
    if (reminder.lastTriggered) {
      const lastDate = new Date(reminder.lastTriggered)
      if (lastDate.toDateString() === now.toDateString()) continue
    }

    triggered.push(reminder)
    updateReminder(reminder.id, { lastTriggered: now.getTime() })
  }

  return triggered
}

// 获取日期范围内的提醒
export function getRemindersInRange(startDate: string, endDate: string): CalendarReminder[] {
  const reminders = getAllReminders()
  return reminders.filter((r) => r.date >= startDate && r.date <= endDate && r.enabled)
}
