import { useState, useMemo, useCallback } from 'react'
import { getMonthCalendar, solarToLunar, getHuangLiInfo, getWesternZodiac, getDateAnalysis } from '@/lib/lunar'
import {
  getMemos, addMemo, deleteMemo,
  getReminders, addReminder, deleteReminder,
  updateReminder, type CalendarReminder,
} from '@/lib/calendar-store'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const MEMO_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'huangli' | 'memo' | 'reminder'>('huangli')
  const [memoRefreshKey, setMemoRefreshKey] = useState(0)
  const [reminderRefreshKey, setReminderRefreshKey] = useState(0)

  const [showMemoForm, setShowMemoForm] = useState(false)
  const [memoTitle, setMemoTitle] = useState('')
  const [memoContent, setMemoContent] = useState('')
  const [memoColor, setMemoColor] = useState(MEMO_COLORS[0])

  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderContent, setReminderContent] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderRepeat, setReminderRepeat] = useState<CalendarReminder['repeat']>('none')

  const calendar = useMemo(
    () => getMonthCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1),
    [currentDate]
  )

  const selectedDateStr = formatDate(selectedDate)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memos = useMemo(() => getMemos(selectedDateStr), [selectedDateStr, memoRefreshKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reminders = useMemo(() => getReminders(selectedDateStr), [selectedDateStr, reminderRefreshKey])

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  const handleAddMemo = useCallback(() => {
    if (!memoTitle.trim()) return
    addMemo({
      date: formatDate(selectedDate),
      title: memoTitle.trim(),
      content: memoContent.trim(),
      color: memoColor,
    })
    setMemoRefreshKey((k) => k + 1)
    setMemoTitle('')
    setMemoContent('')
    setShowMemoForm(false)
  }, [memoTitle, memoContent, memoColor, selectedDate])

  const handleDeleteMemo = useCallback((id: string) => {
    deleteMemo(id)
    setMemoRefreshKey((k) => k + 1)
  }, [])

  const handleAddReminder = useCallback(() => {
    if (!reminderTitle.trim()) return
    addReminder({
      date: formatDate(selectedDate),
      time: reminderTime,
      title: reminderTitle.trim(),
      content: reminderContent.trim(),
      repeat: reminderRepeat,
      enabled: true,
    })
    setReminderRefreshKey((k) => k + 1)
    setReminderTitle('')
    setReminderContent('')
    setShowReminderForm(false)
  }, [reminderTitle, reminderContent, reminderTime, reminderRepeat, selectedDate])

  const handleDeleteReminder = useCallback((id: string) => {
    deleteReminder(id)
    setReminderRefreshKey((k) => k + 1)
  }, [])

  const handleToggleReminder = useCallback((id: string, enabled: boolean) => {
    updateReminder(id, { enabled })
    setReminderRefreshKey((k) => k + 1)
  }, [])

  const lunar = solarToLunar(selectedDate)
  const huangLi = getHuangLiInfo(selectedDate)
  const westernZodiac = getWesternZodiac(selectedDate)
  const analysis = getDateAnalysis(selectedDate)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoDates = useMemo(() => {
    const dates = new Set<string>()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    getMemos().forEach((m) => {
      if (m.date.startsWith(prefix)) dates.add(m.date)
    })
    return dates
  }, [currentDate, memoRefreshKey])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reminderDates = useMemo(() => {
    const dates = new Set<string>()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    getReminders().forEach((r) => {
      if (r.date.startsWith(prefix)) dates.add(r.date)
    })
    return dates
  }, [currentDate, reminderRefreshKey])

  return (
    <div className="flex h-full">
      {/* 左侧日历 */}
      <div className="flex-1 p-4 flex flex-col">
        {/* 月份导航 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold min-w-[120px] text-center">
              {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            onClick={goToday}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            今天
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={`text-center text-sm py-2 ${
                index >= 5 ? 'text-primary/80 font-medium' : 'text-muted-foreground'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {calendar.map((day, index) => {
            const dateStr = formatDate(day.date)
            const isSelected = dateStr === formatDate(selectedDate)
            const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6

            return (
              <button
                key={index}
                onClick={() => setSelectedDate(day.date)}
                className={`
                  relative flex flex-col items-center p-2 rounded-lg transition-all
                  ${day.isCurrentMonth ? '' : 'text-muted-foreground/60'}
                  ${day.isToday
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : isSelected
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/40 font-medium'
                      : isWeekend && day.isCurrentMonth
                        ? 'text-foreground/90 hover:bg-accent/60'
                        : 'hover:bg-accent/50'}
                `}
              >
                <span className="text-sm">{day.date.getDate()}</span>
                {day.festivals && day.festivals.length > 0 ? (
                  <span className={`text-[10px] leading-none font-medium ${
                    day.isToday ? 'text-primary-foreground/90' : 'text-primary'
                  }`}>
                    {day.festivals[0]}
                  </span>
                ) : day.term ? (
                  <span className={`text-[10px] leading-none ${
                    day.isToday ? 'text-primary-foreground/80' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {day.term}
                  </span>
                ) : day.lunar.day === 1 ? (
                  <span className={`text-[10px] leading-none ${
                    day.isToday ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  }`}>
                    {day.lunar.monthName}
                  </span>
                ) : (
                  <span className={`text-[10px] leading-none ${
                    day.isToday ? 'text-primary-foreground/70' : 'text-muted-foreground/80'
                  }`}>
                    {day.lunar.dayName}
                  </span>
                )}
                {(memoDates.has(dateStr) || reminderDates.has(dateStr)) && (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {memoDates.has(dateStr) && (
                      <div className={`w-1 h-1 rounded-full ${day.isToday ? 'bg-primary-foreground' : 'bg-primary'}`} />
                    )}
                    {reminderDates.has(dateStr) && (
                      <div className={`w-1 h-1 rounded-full ${day.isToday ? 'bg-amber-200' : 'bg-amber-500'}`} />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 右侧详情面板 */}
      <div className="w-80 border-l border-border flex flex-col">
        {/* 日期信息头部 */}
        <div className="p-4 border-b border-border">
          <div className="text-2xl font-bold">{selectedDate.getDate()}</div>
          <div className="text-sm text-muted-foreground">
            {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
            {' '}
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'][(selectedDate.getDay() + 6) % 7]}
          </div>
          <div className="text-sm mt-1">
            农历 {lunar.monthName}{lunar.dayName}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {lunar.yearGanZhi}年 · {lunar.shengXiao}年 · {westernZodiac}
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="flex border-b border-border">
          {(['huangli', 'memo', 'reminder'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors
                ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'huangli' ? '黄历' : tab === 'memo' ? '备忘' : '提醒'}
            </button>
          ))}
        </div>

        {/* 标签页内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'huangli' && (
            <div className="p-4 space-y-4">
              {/* 分析概览 */}
              <div className="p-3 bg-secondary/50 rounded-lg">
                <div className="text-sm font-medium mb-2">今日分析</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>心情：{analysis.mood}</div>
                  <div>幸运色：{analysis.color}</div>
                  <div>吉位：{analysis.direction}</div>
                </div>
              </div>

              {/* 宜忌 */}
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">宜</span>
                  <span className="text-xs text-muted-foreground">({huangLi.zhiShen}日)</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {huangLi.yi.map((item) => (
                    <span key={item} className="px-2 py-1 text-xs rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">忌</div>
                <div className="flex flex-wrap gap-1">
                  {huangLi.ji.map((item) => (
                    <span key={item} className="px-2 py-1 text-xs rounded border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* 干支信息 */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div>日柱：{lunar.dayGanZhi}</div>
                <div>纳音：{lunar.naYin}</div>
                <div>彭祖：{huangLi.pengZu}</div>
                <div>冲煞：{huangLi.chongSha} {huangLi.chongFang}</div>
                <div>星宿：{huangLi.xingSuo}</div>
              </div>

              {/* 吉神凶煞 */}
              {huangLi.jiShen.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1">吉神</div>
                  <div className="flex flex-wrap gap-1">
                    {huangLi.jiShen.map((s) => (
                      <span key={s} className="px-2 py-0.5 text-xs rounded border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {huangLi.xiongSha.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1">凶煞</div>
                  <div className="flex flex-wrap gap-1">
                    {huangLi.xiongSha.map((s) => (
                      <span key={s} className="px-2 py-0.5 text-xs rounded border border-border bg-muted/50 text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'memo' && (
            <div className="p-4">
              {showMemoForm ? (
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="标题"
                    value={memoTitle}
                    onChange={(e) => setMemoTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <textarea
                    placeholder="内容"
                    value={memoContent}
                    onChange={(e) => setMemoContent(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none h-20"
                  />
                  <div className="flex gap-1">
                    {MEMO_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setMemoColor(color)}
                        className={`w-6 h-6 rounded-full transition-transform ${memoColor === color ? 'scale-125 ring-2 ring-primary' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddMemo}
                      className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowMemoForm(false)}
                      className="flex-1 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/80"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowMemoForm(true)}
                  className="w-full py-2 text-sm border border-dashed border-border rounded-lg hover:bg-secondary/50 mb-4"
                >
                  + 添加备忘
                </button>
              )}

              <div className="space-y-2">
                {memos.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    暂无备忘
                  </div>
                ) : (
                  memos.map((memo) => (
                    <div
                      key={memo.id}
                      className="p-3 rounded-lg border border-border"
                      style={{ borderLeftColor: memo.color, borderLeftWidth: 3 }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-medium text-sm">{memo.title}</div>
                        <button
                          onClick={() => handleDeleteMemo(memo.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {memo.content && (
                        <div className="text-xs text-muted-foreground mt-1">{memo.content}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'reminder' && (
            <div className="p-4">
              {showReminderForm ? (
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="标题"
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <textarea
                    placeholder="内容 (可选)"
                    value={reminderContent}
                    onChange={(e) => setReminderContent(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none h-16"
                  />
                  <div>
                    <label className="text-xs text-muted-foreground">提醒时间</label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">重复</label>
                    <select
                      value={reminderRepeat}
                      onChange={(e) => setReminderRepeat(e.target.value as CalendarReminder['repeat'])}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary mt-1"
                    >
                      <option value="none">不重复</option>
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                      <option value="monthly">每月</option>
                      <option value="yearly">每年</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddReminder}
                      className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowReminderForm(false)}
                      className="flex-1 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/80"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowReminderForm(true)}
                  className="w-full py-2 text-sm border border-dashed border-border rounded-lg hover:bg-secondary/50 mb-4"
                >
                  + 添加提醒
                </button>
              )}

              <div className="space-y-2">
                {reminders.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    暂无提醒
                  </div>
                ) : (
                  reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={`p-3 rounded-lg border border-border ${reminder.enabled ? '' : 'opacity-50'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className="text-amber-600 dark:text-amber-400 font-medium">{reminder.time}</span>
                            {reminder.title}
                          </div>
                          {reminder.content && (
                            <div className="text-xs text-muted-foreground mt-1">{reminder.content}</div>
                          )}
                          {reminder.repeat !== 'none' && (
                            <div className="text-xs text-muted-foreground mt-1">
                              重复：{reminder.repeat === 'daily' ? '每天' : reminder.repeat === 'weekly' ? '每周' : reminder.repeat === 'monthly' ? '每月' : '每年'}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleReminder(reminder.id, !reminder.enabled)}
                            className={`w-8 h-4 rounded-full transition-colors ${reminder.enabled ? 'bg-primary' : 'bg-muted'}`}
                          >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${reminder.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          <button
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="text-muted-foreground hover:text-destructive ml-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
