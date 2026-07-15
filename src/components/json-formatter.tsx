import { useState, useEffect, useCallback, useMemo } from 'react'
import { JsonTree } from './json-tree'
import { JsonPretty } from './json-pretty'
import { jsonThemes } from '@/lib/json-themes'
import { copyToClipboard as tauriCopy } from '@/lib/clipboard-api'

type IndentSize = 2 | 4
type OutputMode = 'tree' | 'compressed'

interface JsonFormatterProps {
  initialInput?: string
}

export function JsonFormatter({ initialInput }: JsonFormatterProps) {
  const [input, setInput] = useState(initialInput ?? '')
  const [indent, setIndent] = useState<IndentSize>(2)
  const [themeIndex, setThemeIndex] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [expandAll, setExpandAll] = useState(true)
  const [outputMode, setOutputMode] = useState<OutputMode>('tree')

  const theme = jsonThemes[themeIndex]

  useEffect(() => {
    if (initialInput !== undefined) {
      setInput(initialInput)
      setError('')
      setOutputMode('tree')
    }
  }, [initialInput])

  const parsed = useMemo(() => {
    if (!input.trim()) {
      setError('')
      return null
    }
    try {
      const result = JSON.parse(input)
      setError('')
      return result
    } catch (e) {
      setError((e as Error).message)
      return null
    }
  }, [input])

  const formatted = useMemo(() => {
    if (parsed === null) return ''
    return JSON.stringify(parsed, null, indent)
  }, [parsed, indent])

  const compressed = useMemo(() => {
    if (!formatted) return ''
    return JSON.stringify(JSON.parse(formatted))
  }, [formatted])

  const handleCopy = useCallback(async (text: string) => {
    if (!text) return
    try {
      await tauriCopy(text)
    } catch {
      // silent
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const handleFormat = useCallback(() => {
    if (parsed === null) return
    setExpandAll(true)
    setOutputMode('tree')
  }, [parsed])

  const handleCompress = useCallback(() => {
    if (parsed === null || !formatted) return
    setOutputMode('compressed')
  }, [parsed, formatted])

  const clear = useCallback(() => {
    setInput('')
    setError('')
    setOutputMode('tree')
  }, [])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
      setOutputMode('tree')
    } catch {
      // silent
    }
  }, [])

  const handleInputChange = (value: string) => {
    setInput(value)
    setOutputMode('tree')
  }

  const copyText =
    outputMode === 'compressed' ? compressed : formatted

  const outputLabel = outputMode === 'compressed' ? '（压缩）' : ''

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">JSON</h2>
          <p className="text-sm text-muted-foreground mt-1">粘贴 JSON，自动美化并树形展示</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="text-sm text-muted-foreground">配色:</label>
          <select
            value={themeIndex}
            onChange={(e) => setThemeIndex(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-input rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {jsonThemes.map((t, i) => (
              <option key={t.name} value={i}>{t.name}</option>
            ))}
          </select>
          <label className="text-sm text-muted-foreground">缩进:</label>
          <select
            value={indent}
            onChange={(e) => {
              setIndent(Number(e.target.value) as IndentSize)
              setOutputMode('tree')
            }}
            className="px-2 py-1 text-sm border border-input rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={2}>2 空格</option>
            <option value={4}>4 空格</option>
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-foreground">输入</span>
            <div className="flex gap-1">
              <button
                onClick={handlePaste}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                粘贴
              </button>
              <button
                onClick={clear}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                清空
              </button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="粘贴 API 响应、配置文件等 JSON 内容…"
            className="flex-1 resize-none rounded-lg border border-input bg-card p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-0"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-foreground">
              预览{outputLabel}
            </span>
            <div className="flex gap-1">
              {parsed !== null && outputMode === 'tree' && (
                <button
                  onClick={() => setExpandAll(!expandAll)}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                >
                  {expandAll ? '全部折叠' : '全部展开'}
                </button>
              )}
              <button
                onClick={() => handleCopy(copyText)}
                disabled={!parsed}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? '已复制!' : '复制'}
              </button>
            </div>
          </div>
          <div
            className={`flex-1 rounded-lg border p-3 font-mono text-sm min-h-0 overflow-auto ${
              error
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-input bg-muted'
            }`}
          >
            {error ? (
              <div className="text-destructive">{error}</div>
            ) : parsed !== null && outputMode === 'compressed' ? (
              <JsonPretty text={compressed} theme={theme} compressed />
            ) : parsed !== null ? (
              <JsonTree value={parsed} expandAll={expandAll} indent={indent} theme={theme} />
            ) : (
              <div className="text-muted-foreground">输入合法 JSON 后在此预览</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleFormat}
          disabled={!parsed}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          美化
        </button>
        <button
          onClick={handleCompress}
          disabled={!parsed}
          className="px-4 py-2 border border-primary/50 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          压缩
        </button>
      </div>
    </div>
  )
}
