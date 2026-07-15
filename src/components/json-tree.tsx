import { useState, useCallback, useMemo, useEffect } from 'react'
import type { JsonTheme } from '@/lib/json-themes'

interface JsonTreeProps {
  value: unknown
  expandAll: boolean
  indent: number
  theme: JsonTheme
  isLast?: boolean
  depth?: number
}

export function JsonTree({ value, expandAll, indent, theme, isLast = true, depth = 0 }: JsonTreeProps) {
  const type = useMemo(() => {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }, [value])

  if (type === 'object' || type === 'array') {
    return (
      <CollapsibleNode
        value={value}
        type={type}
        expandAll={expandAll}
        indent={indent}
        theme={theme}
        isLast={isLast}
        depth={depth}
      />
    )
  }

  return <PrimitiveValue value={value} type={type} theme={theme} isLast={isLast} />
}

function CollapsibleNode({
  value,
  type,
  expandAll,
  indent,
  theme,
  isLast,
  depth,
}: {
  value: unknown
  type: string
  expandAll: boolean
  indent: number
  theme: JsonTheme
  isLast: boolean
  depth: number
}) {
  const [expanded, setExpanded] = useState(expandAll)

  useEffect(() => {
    setExpanded(expandAll)
  }, [expandAll])

  const entries = useMemo(() => {
    if (type === 'array') {
      return (value as unknown[]).map((v, i) => ({ key: i, value: v }))
    }
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      value: v,
    }))
  }, [value, type])

  const toggle = useCallback(() => setExpanded((prev) => !prev), [])

  const prefix = type === 'array' ? '[' : '{'
  const suffix = type === 'array' ? ']' : '}'

  const pad = (level: number) => `${level * indent * 0.6}em`

  if (!expanded) {
    const count = entries.length
    const label = type === 'array' ? `${count} items` : `${count} keys`
    return (
      <div className="leading-relaxed">
        <div style={{ paddingLeft: pad(depth) }}>
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1 hover:bg-accent/50 rounded px-0.5"
          >
            <span className="text-muted-foreground text-xs">▶</span>
            <span style={{ color: theme.bracket }}>{prefix}</span>
            <span className="text-muted-foreground text-xs italic">... {label} ...</span>
            <span style={{ color: theme.bracket }}>{suffix}</span>
            {!isLast && <span className="text-muted-foreground">,</span>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="leading-relaxed">
      <div style={{ paddingLeft: pad(depth) }}>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1 hover:bg-accent/50 rounded px-0.5"
        >
          <span className="text-muted-foreground text-xs">▼</span>
          <span style={{ color: theme.bracket }}>{prefix}</span>
        </button>
      </div>
      {entries.map((entry, i) => (
        <div key={entry.key} style={{ paddingLeft: pad(depth + 1) }}>
          {type === 'object' && (
            <>
              <span style={{ color: theme.key }}>"{String(entry.key)}"</span>
              <span className="text-muted-foreground">: </span>
            </>
          )}
          <JsonTree
            value={entry.value}
            expandAll={expandAll}
            indent={indent}
            theme={theme}
            isLast={i === entries.length - 1}
            depth={depth + 1}
          />
        </div>
      ))}
      <div style={{ paddingLeft: pad(depth) }}>
        <span style={{ color: theme.bracket }}>{suffix}</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    </div>
  )
}

function PrimitiveValue({
  value,
  type,
  theme,
  isLast,
}: {
  value: unknown
  type: string
  theme: JsonTheme
  isLast: boolean
}) {
  const color = useMemo(() => {
    switch (type) {
      case 'string':
        return theme.string
      case 'number':
        return theme.number
      case 'boolean':
        return theme.boolean
      case 'null':
        return theme.null
      default:
        return undefined
    }
  }, [type, theme])

  const display = useMemo(() => {
    if (type === 'null') return 'null'
    if (type === 'string') return `"${value}"`
    return String(value)
  }, [value, type])

  return (
    <span style={{ color }}>
      {display}
      {!isLast && <span className="text-muted-foreground">,</span>}
    </span>
  )
}
