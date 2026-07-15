import { useMemo, type ReactNode } from 'react'
import type { JsonTheme } from '@/lib/json-themes'

interface JsonPrettyProps {
  text: string
  theme: JsonTheme
  compressed?: boolean
}

export function JsonPretty({ text, theme, compressed = false }: JsonPrettyProps) {
  const highlighted = useMemo(() => highlightJson(text, theme), [text, theme])

  return (
    <pre
      className={
        compressed
          ? 'whitespace-pre-wrap break-all leading-relaxed'
          : 'whitespace-pre leading-relaxed overflow-x-auto'
      }
    >
      {highlighted}
    </pre>
  )
}

function highlightJson(text: string, theme: JsonTheme): ReactNode[] {
  const nodes: ReactNode[] = []
  let i = 0
  let key = 0

  const push = (node: ReactNode) => {
    nodes.push(<span key={key++}>{node}</span>)
  }

  while (i < text.length) {
    const ch = text[i]

    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      let j = i + 1
      while (j < text.length && ' \n\r\t'.includes(text[j])) j++
      push(text.slice(i, j))
      i = j
      continue
    }

    if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      push(<span style={{ color: theme.bracket }}>{ch}</span>)
      i++
      continue
    }

    if (ch === ':' || ch === ',') {
      push(<span className="text-muted-foreground">{ch}</span>)
      i++
      continue
    }

    if (ch === '"') {
      const start = i
      i++
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === '"') {
          i++
          break
        }
        i++
      }
      const str = text.slice(start, i)
      let j = i
      while (j < text.length && ' \n\r\t'.includes(text[j])) j++
      const isKey = text[j] === ':'
      push(
        <span style={{ color: isKey ? theme.key : theme.string }}>{str}</span>,
      )
      continue
    }

    const rest = text.slice(i)
    const numMatch = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    if (numMatch) {
      push(<span style={{ color: theme.number }}>{numMatch[0]}</span>)
      i += numMatch[0].length
      continue
    }

    if (rest.startsWith('true') || rest.startsWith('false')) {
      const word = rest.startsWith('true') ? 'true' : 'false'
      push(<span style={{ color: theme.boolean }}>{word}</span>)
      i += word.length
      continue
    }

    if (rest.startsWith('null')) {
      push(<span style={{ color: theme.null }}>null</span>)
      i += 4
      continue
    }

    push(ch)
    i++
  }

  return nodes
}
