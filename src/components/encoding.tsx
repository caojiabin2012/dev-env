import { useState, useCallback } from 'react'
import { copyToClipboard } from '@/lib/clipboard-api'
import { formatDateTimeShanghai, parseDateTimeShanghai } from '@/lib/date-time'
import { notify } from '@/lib/toast'

type TabType = 'base64' | 'url' | 'timestamp'

export function EncodingTool() {
  const [tab, setTab] = useState<TabType>('timestamp')

  return (
    <div className="h-full flex flex-col">
      {/* 标签页 */}
      <div className="flex border-b border-border px-4">
        {(['timestamp', 'base64', 'url'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t === 'timestamp' ? '时间戳转换' : t === 'base64' ? 'Base64' : 'URL 编解码'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'timestamp' && <TimestampTool />}
        {tab === 'base64' && <Base64Tool />}
        {tab === 'url' && <UrlTool />}
      </div>
    </div>
  )
}

function Base64Tool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const handleConvert = useCallback(() => {
    setError('')
    if (!input.trim()) {
      setOutput('')
      return
    }
    try {
      if (mode === 'encode') {
        const encoded = btoa(unescape(encodeURIComponent(input)))
        setOutput(encoded)
      } else {
        const decoded = decodeURIComponent(escape(atob(input)))
        setOutput(decoded)
      }
    } catch {
      setError(mode === 'encode' ? '编码失败' : '解码失败，请检查输入是否为有效的 Base64')
      setOutput('')
    }
  }, [input, mode])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setMode('encode')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            mode === 'encode' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          编码
        </button>
        <button
          onClick={() => setMode('decode')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            mode === 'decode' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          解码
        </button>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">输入</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'encode' ? '请输入要编码的文本...' : '请输入 Base64 字符串...'}
          className="w-full h-32 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <button
        onClick={handleConvert}
        className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        {mode === 'encode' ? '编码' : '解码'}
      </button>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {output && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">输出</label>
            <button
              onClick={() => navigator.clipboard.writeText(output)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              复制
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            className="w-full h-32 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-secondary/30 resize-none"
          />
        </div>
      )}
    </div>
  )
}

function UrlTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')

  const handleConvert = useCallback(() => {
    setError('')
    if (!input.trim()) {
      setOutput('')
      return
    }
    try {
      if (mode === 'encode') {
        setOutput(encodeURIComponent(input))
      } else {
        setOutput(decodeURIComponent(input))
      }
    } catch {
      setError('转换失败，请检查输入')
      setOutput('')
    }
  }, [input, mode])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setMode('encode')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            mode === 'encode' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          编码
        </button>
        <button
          onClick={() => setMode('decode')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            mode === 'decode' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          解码
        </button>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">输入</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'encode' ? '请输入要编码的 URL...' : '请输入 URL 编码字符串...'}
          className="w-full h-32 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <button
        onClick={handleConvert}
        className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        {mode === 'encode' ? '编码' : '解码'}
      </button>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {output && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">输出</label>
            <button
              onClick={() => navigator.clipboard.writeText(output)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              复制
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            className="w-full h-32 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-secondary/30 resize-none"
          />
        </div>
      )}
    </div>
  )
}

function TimestampTool() {
  const [timestamp, setTimestamp] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [unit, setUnit] = useState<'s' | 'ms'>('s')
  const [result, setResult] = useState<{ timestamp: string; date: string } | null>(null)
  const [error, setError] = useState('')

  const now = Math.floor(Date.now() / (unit === 's' ? 1000 : 1))

  const handleTimestampToDate = useCallback(() => {
    setError('')
    if (!timestamp.trim()) {
      setError('请输入时间戳')
      return
    }
    const ts = parseInt(timestamp)
    if (isNaN(ts)) {
      setError('请输入有效的时间戳')
      return
    }
    const ms = unit === 's' ? ts * 1000 : ts
    const date = new Date(ms)
    if (isNaN(date.getTime())) {
      setError('无效的时间戳')
      return
    }
    setResult({
      timestamp: ts.toString(),
      date: formatDateTimeShanghai(date),
    })
  }, [timestamp, unit])

  const handleDateToTimestamp = useCallback(() => {
    setError('')
    if (!dateStr.trim()) {
      setError('请输入日期时间')
      return
    }
    const date = parseDateTimeShanghai(dateStr)
    if (!date) {
      setError('无效的日期格式，请使用 YYYY-MM-DD HH:mm:ss')
      return
    }
    const ts = unit === 's' ? Math.floor(date.getTime() / 1000) : date.getTime()
    setResult({
      timestamp: ts.toString(),
      date: formatDateTimeShanghai(date),
    })
  }, [dateStr, unit])

  const handleNow = useCallback(() => {
    const nowTs = unit === 's' ? Math.floor(Date.now() / 1000) : Date.now()
    const date = new Date()
    const formatted = formatDateTimeShanghai(date)
    setTimestamp(nowTs.toString())
    setDateStr(formatted)
    setResult({
      timestamp: nowTs.toString(),
      date: formatted,
    })
  }, [unit])

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await copyToClipboard(text)
      notify(`已复制${label}`)
    } catch {
      notify('复制失败')
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setUnit('s')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              unit === 's' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
            }`}
          >
            秒 (s)
          </button>
          <button
            onClick={() => setUnit('ms')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              unit === 'ms' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
            }`}
          >
            毫秒 (ms)
          </button>
        </div>
        <button
          onClick={handleNow}
          className="px-4 py-2 text-sm bg-secondary rounded-lg hover:bg-secondary/80"
        >
          获取当前时间
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">时间戳 → 日期</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder={`当前: ${now}`}
              className="flex-1 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleTimestampToDate}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              转换
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">日期 → 时间戳</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              placeholder="YYYY-MM-DD HH:mm:ss"
              className="flex-1 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleDateToTimestamp}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              转换
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {result && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground shrink-0">时间戳：</span>
            <span className="font-mono">{result.timestamp}</span>
            <button
              onClick={() => handleCopy(result.timestamp, '时间戳')}
              className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              复制
            </button>
          </div>
          <div className="text-sm flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground shrink-0">日期时间：</span>
            <span className="font-mono">{result.date}</span>
            <button
              onClick={() => handleCopy(result.date, '日期时间')}
              className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              复制
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
        <div className="font-medium text-foreground mb-1">说明：</div>
        <div>• 时间戳是自 1970-01-01 00:00:00 UTC 以来的秒数或毫秒数</div>
        <div>• 当前时间戳：{Math.floor(Date.now() / 1000)} (秒) / {Date.now()} (毫秒)</div>
      </div>
    </div>
  )
}
