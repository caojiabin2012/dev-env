import { useState, useMemo } from 'react'
import { formatDateTimeShanghai } from '@/lib/date-time'

type TabType = 'regex' | 'cron'

const DEV_TAB_ACTIVE = 'text-primary border-primary'
const DEV_BTN_SELECTED = 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'

export function DevTool() {
  const [tab, setTab] = useState<TabType>('regex')

  return (
    <div className="h-full flex flex-col">
      {/* 标签页 */}
      <div className="flex border-b border-border px-4">
        {(['regex', 'cron'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? DEV_TAB_ACTIVE
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t === 'regex' ? '正则测试' : 'Cron 表达式'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'regex' && <RegexTool />}
        {tab === 'cron' && <CronTool />}
      </div>
    </div>
  )
}

function RegexTool() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [testString, setTestString] = useState('')
  const [error, setError] = useState('')

  const presets = [
    { label: '手机号', pattern: '1[3-9]\\d{9}', sample: '我的手机是13812345678，他的手机是15987654321' },
    { label: '邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', sample: '联系我：test@example.com 或 user.name@domain.cn' },
    { label: '身份证', pattern: '[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]', sample: '身份证：110101199003071234，错误：123456789012345678' },
    { label: 'URL', pattern: 'https?://[\\w\\-]+(\\.[\\w\\-]+)+[/\\w\\-.~:/?#\\[\\]@!$&\'()*+,;=%]*', sample: '访问 https://www.example.com/path?q=1 或 http://test.cn/page' },
    { label: 'IP地址', pattern: '(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)', sample: '服务器：192.168.1.100，网关：10.0.0.1，无效：999.999.999.999' },
    { label: '日期', pattern: '(19|20)\\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\\d|3[01])', sample: '日期：2024-01-15，格式：2024/12/31，无效：2024-13-01' },
    { label: '时间', pattern: '([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?', sample: '开始时间：09:30，结束：18:00:00，无效：25:61' },
    { label: '中文', pattern: '[\\u4e00-\\u9fa5]+', sample: 'Hello 你好世界 World 测试中文匹配' },
    { label: '银行卡号', pattern: '[1-9]\\d{15,18}', sample: '卡号：6222021234567890123，错误：0123456789' },
    { label: '邮政编码', pattern: '[1-9]\\d{5}', sample: '北京：100000，上海：200000，无效：012345' },
    { label: '十六进制颜色', pattern: '#([0-9a-fA-F]{3}){1,2}', sample: '颜色：#fff，#FF5733，#000000，无效：#GGG' },
    { label: 'HTML标签', pattern: '<([a-z]+)([^<]*)>(.*?)</\\1>', sample: '<p>段落</p>，<div class="a">内容</div>，<br/>' },
  ]

  const handlePreset = (preset: typeof presets[0]) => {
    setPattern(preset.pattern)
    setTestString(preset.sample)
  }

  const matches = useMemo(() => {
    setError('')
    if (!pattern || !testString) return []
    try {
      const regex = new RegExp(pattern, flags)
      const results: { match: string; index: number; groups: string[] }[] = []
      let match: RegExpExecArray | null

      if (flags.includes('g')) {
        while ((match = regex.exec(testString)) !== null) {
          results.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1),
          })
          if (match.index === regex.lastIndex) {
            regex.lastIndex++
          }
        }
      } else {
        match = regex.exec(testString)
        if (match) {
          results.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1),
          })
        }
      }
      return results
    } catch (e) {
      setError((e as Error).message)
      return []
    }
  }, [pattern, flags, testString])

  const highlightMatches = useMemo(() => {
    if (!pattern || !testString || matches.length === 0) return testString
    try {
      const regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
      return testString.replace(regex, (match) => `<mark class="bg-yellow-200 dark:bg-yellow-800">${match}</mark>`)
    } catch {
      return testString
    }
  }, [pattern, flags, testString, matches])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">正则表达式</label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center border border-border rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3 text-muted-foreground">/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="输入正则表达式..."
              className="flex-1 px-1 py-2 text-sm font-mono text-foreground bg-transparent focus:outline-none"
            />
            <span className="pr-1 text-muted-foreground">/</span>
            <input
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="g"
              className="w-12 px-1 py-2 text-sm font-mono text-foreground bg-transparent focus:outline-none text-center"
            />
          </div>
        </div>
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">常用正则</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                pattern === preset.pattern
                  ? DEV_BTN_SELECTED
                  : 'bg-secondary hover:bg-secondary/80 border-border'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">测试文本</label>
        <textarea
          value={testString}
          onChange={(e) => setTestString(e.target.value)}
          placeholder="输入要测试的文本..."
          className="w-full h-32 px-3 py-2 text-sm font-mono text-foreground border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">高亮预览</label>
        <div
          className="w-full min-h-[80px] px-3 py-2 text-sm font-mono text-foreground border border-border rounded-lg bg-secondary/30 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: highlightMatches || '<span class="text-muted-foreground">无匹配</span>' }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">匹配结果</label>
          <span className="text-xs text-muted-foreground">{matches.length} 个匹配</span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
          {matches.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">无匹配结果</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">匹配内容</th>
                  <th className="px-3 py-2 text-left font-medium">位置</th>
                  <th className="px-3 py-2 text-left font-medium">分组</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{m.match}</td>
                    <td className="px-3 py-2 text-xs">{m.index}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {m.groups.length > 0 ? m.groups.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
        <div className="font-medium text-foreground mb-1">常用标志：</div>
        <div><code>g</code> 全局匹配 &nbsp; <code>i</code> 忽略大小写 &nbsp; <code>m</code> 多行模式 &nbsp; <code>s</code> 点号匹配换行</div>
      </div>
    </div>
  )
}

interface CronParts {
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

function parseCronExpression(expression: string): { parts: CronParts | null; error: string } {
  const trimmed = expression.trim()
  if (!trimmed) return { parts: null, error: '' }
  const segments = trimmed.split(/\s+/)
  if (segments.length !== 5) {
    return { parts: null, error: 'Cron 表达式需要 5 个部分：分 时 日 月 周' }
  }
  return {
    parts: {
      minute: segments[0],
      hour: segments[1],
      dayOfMonth: segments[2],
      month: segments[3],
      dayOfWeek: segments[4],
    },
    error: '',
  }
}

function matchCronField(field: string, value: number): boolean {
  if (field === '*') return true

  if (field.includes('/')) {
    const [base, stepStr] = field.split('/')
    const step = parseInt(stepStr, 10)
    if (Number.isNaN(step) || step <= 0) return false
    if (base === '*') return value % step === 0
    const start = parseInt(base, 10)
    if (Number.isNaN(start)) return false
    return value >= start && (value - start) % step === 0
  }

  if (field.includes(',')) {
    return field.split(',').some((item) => matchCronField(item.trim(), value))
  }

  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-')
    const start = parseInt(startStr, 10)
    const end = parseInt(endStr, 10)
    if (Number.isNaN(start) || Number.isNaN(end)) return false
    return value >= start && value <= end
  }

  const num = parseInt(field, 10)
  return !Number.isNaN(num) && num === value
}

function matchesCronDate(parts: CronParts, date: Date): boolean {
  const minute = date.getMinutes()
  const hour = date.getHours()
  const day = date.getDate()
  const month = date.getMonth() + 1
  const weekday = date.getDay()

  if (!matchCronField(parts.minute, minute)) return false
  if (!matchCronField(parts.hour, hour)) return false
  if (!matchCronField(parts.month, month)) return false

  const domMatch = matchCronField(parts.dayOfMonth, day)
  const dowMatch = matchCronField(parts.dayOfWeek, weekday)
  const domAll = parts.dayOfMonth === '*'
  const dowAll = parts.dayOfWeek === '*'

  if (!domAll && !dowAll) return domMatch || dowMatch
  return domMatch && dowMatch
}

function getNextCronRuns(parts: CronParts, count: number): Date[] {
  const runs: Date[] = []
  const cursor = new Date()
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const maxMinutes = 366 * 24 * 60
  for (let i = 0; i < maxMinutes && runs.length < count; i++) {
    const checkDate = new Date(cursor.getTime() + i * 60000)
    if (matchesCronDate(parts, checkDate)) {
      runs.push(checkDate)
    }
  }
  return runs
}

function CronTool() {
  const [expression, setExpression] = useState('')

  const { parts: cronParts, error } = useMemo(
    () => parseCronExpression(expression),
    [expression],
  )

  const description = useMemo(() => {
    if (!cronParts) return ''

    const describeField = (value: string, type: 'minute' | 'hour' | 'day' | 'month' | 'weekday'): string => {
      if (value === '*') {
        switch (type) {
          case 'minute': return '每分钟'
          case 'hour': return '每小时'
          case 'day': return '每天'
          case 'month': return '每月'
          case 'weekday': return '每星期'
        }
      }
      if (value.includes('/')) {
        const [, interval] = value.split('/')
        switch (type) {
          case 'minute': return `每隔 ${interval} 分钟`
          case 'hour': return `每隔 ${interval} 小时`
          case 'day': return `每隔 ${interval} 天`
          case 'month': return `每隔 ${interval} 个月`
          case 'weekday': return `每隔 ${interval} 周`
        }
      }
      if (value.includes('-')) {
        const [start, end] = value.split('-')
        switch (type) {
          case 'minute': return `${start} 到 ${end} 分钟`
          case 'hour': return `${start} 到 ${end} 时`
          case 'day': return `${start} 到 ${end} 日`
          case 'month': return `${start} 到 ${end} 月`
          case 'weekday': return `${start} 到 ${end} 星期`
        }
      }
      if (value.includes(',')) {
        const items = value.split(',')
        switch (type) {
          case 'minute': return `第 ${items.join('、')} 分钟`
          case 'hour': return `第 ${items.join('、')} 时`
          case 'day': return `第 ${items.join('、')} 日`
          case 'month': return `第 ${items.join('、')} 月`
          case 'weekday': return `星期 ${items.join('、')}`
        }
      }
      return value
    }

    const minute = describeField(cronParts.minute, 'minute')
    const hour = describeField(cronParts.hour, 'hour')
    const day = describeField(cronParts.dayOfMonth, 'day')
    const month = describeField(cronParts.month, 'month')
    const weekday = describeField(cronParts.dayOfWeek, 'weekday')

    if (cronParts.minute !== '*' && cronParts.hour !== '*') {
      return `${month}的${day}，${weekday}，${hour}:${cronParts.minute.padStart(2, '0')} 执行`
    }
    if (cronParts.minute !== '*') {
      return `${month}的${day}，${weekday}，${hour}时的${minute}执行`
    }
    return `${month}的${day}，${weekday}，${hour}执行`
  }, [cronParts])

  const nextRuns = useMemo(() => {
    if (!cronParts) return []
    return getNextCronRuns(cronParts, 10)
  }, [cronParts])

  const presets = [
    { label: '每分钟', value: '* * * * *' },
    { label: '每小时', value: '0 * * * *' },
    { label: '每天 0 点', value: '0 0 * * *' },
    { label: '每天 9 点', value: '0 9 * * *' },
    { label: '每周一 9 点', value: '0 9 * * 1' },
    { label: '每月 1 号 0 点', value: '0 0 1 * *' },
    { label: '每 5 分钟', value: '*/5 * * * *' },
    { label: '每 30 分钟', value: '*/30 * * * *' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Cron 表达式</label>
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="* * * * *"
          className="w-full px-3 py-2 text-sm font-mono text-foreground border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">快速选择</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setExpression(preset.value)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                expression === preset.value
                  ? DEV_BTN_SELECTED
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {description && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div>
            <span className="text-sm font-medium">含义：</span>
            <span className="text-sm">{description}</span>
          </div>

          {cronParts && (
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="text-center">
                <div className="text-muted-foreground">分钟</div>
                <div className="font-mono font-medium text-foreground">{cronParts.minute}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">小时</div>
                <div className="font-mono font-medium text-foreground">{cronParts.hour}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">日</div>
                <div className="font-mono font-medium text-foreground">{cronParts.dayOfMonth}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">月</div>
                <div className="font-mono font-medium text-foreground">{cronParts.month}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">星期</div>
                <div className="font-mono font-medium text-foreground">{cronParts.dayOfWeek}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {nextRuns.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-1 block">下次执行时间</label>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">时间</th>
                  <th className="px-3 py-2 text-left font-medium">星期</th>
                </tr>
              </thead>
              <tbody>
                {nextRuns.map((run, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">
                      {formatDateTimeShanghai(run)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][run.getDay()]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
        <div className="font-medium text-foreground mb-1">格式说明：</div>
        <div><code>分 时 日 月 周</code></div>
        <div className="mt-1">
          <code>*</code> 任意值 &nbsp;
          <code>*/5</code> 每隔5 &nbsp;
          <code>1,3,5</code> 指定值 &nbsp;
          <code>1-5</code> 范围
        </div>
        <div className="mt-1">星期：0=周日, 1=周一, ..., 6=周六</div>
      </div>
    </div>
  )
}
