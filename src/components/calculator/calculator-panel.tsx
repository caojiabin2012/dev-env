import { useState, useRef, useCallback, useMemo } from 'react'
import { evaluate, formatResult } from './formula-parser'

interface HistoryItem {
  expr: string
  result: string
}

export function CalculatorPanel() {
  const [expression, setExpression] = useState('')
  const [angleMode, setAngleMode] = useState<'deg' | 'rad'>('deg')
  const [showScientific, setShowScientific] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { result, error } = useMemo(() => {
    if (!expression.trim()) {
      return { result: '', error: '' }
    }
    try {
      const value = evaluate(expression, angleMode)
      return { result: formatResult(value), error: '' }
    } catch (e) {
      return { result: '', error: (e as Error).message }
    }
  }, [expression, angleMode])

  const insertAtCursor = useCallback((text: string) => {
    const input = inputRef.current
    if (input) {
      const start = input.selectionStart || expression.length
      const end = input.selectionEnd || expression.length
      const newExpr = expression.slice(0, start) + text + expression.slice(end)
      setExpression(newExpr)
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + text.length
        input.focus()
      }, 0)
    } else {
      setExpression(prev => prev + text)
    }
  }, [expression])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (result && !error) {
        setHistory(prev => [{ expr: expression, result }, ...prev].slice(0, 50))
        setExpression(result.replace(/,/g, ''))
      }
    } else if (e.key === 'Escape') {
      setExpression('')
    }
  }, [expression, result, error])

  const clearAll = () => {
    setExpression('')
  }

  const backspace = () => {
    const input = inputRef.current
    if (input) {
      const start = input.selectionStart || expression.length
      const end = input.selectionEnd || expression.length
      if (start !== end) {
        setExpression(expression.slice(0, start) + expression.slice(end))
      } else if (start > 0) {
        setExpression(expression.slice(0, start - 1) + expression.slice(start))
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start - 1
          input.focus()
        }, 0)
      }
    } else {
      setExpression(prev => prev.slice(0, -1))
    }
  }

  const toggleAngleMode = () => {
    setAngleMode(prev => prev === 'deg' ? 'rad' : 'deg')
  }

  const handleScientificButton = (label: string) => {
    const actionMap: Record<string, () => void> = {
      '2nd': () => {},
      'π': () => insertAtCursor('π'),
      'e': () => insertAtCursor('e'),
      '%': () => insertAtCursor('%'),
      'AC': clearAll,
      'x²': () => insertAtCursor('^2'),
      'xʸ': () => insertAtCursor('^('),
      '√x': () => insertAtCursor('√('),
      'n!': () => insertAtCursor('!'),
      'EE': () => insertAtCursor('e'),
      '1/x': () => insertAtCursor('1/('),
      'ln': () => insertAtCursor('ln('),
      'log': () => insertAtCursor('log('),
      'eˣ': () => insertAtCursor('e^('),
      '10ˣ': () => insertAtCursor('10^('),
      'sin': () => insertAtCursor('sin('),
      'cos': () => insertAtCursor('cos('),
      'tan': () => insertAtCursor('tan('),
      'Deg': toggleAngleMode,
      'Rad': toggleAngleMode,
      '(': () => insertAtCursor('('),
      ')': () => insertAtCursor(')'),
      'sin⁻¹': () => insertAtCursor('asin('),
      'cos⁻¹': () => insertAtCursor('acos('),
      'tan⁻¹': () => insertAtCursor('atan('),
    }
    actionMap[label]?.()
  }

  const angleLabel = angleMode === 'deg' ? 'Deg' : 'Rad'

  const scientificRows = [
    ['2nd', 'π', 'e', '%', 'AC'],
    ['x²', 'xʸ', '√x', 'n!', 'EE'],
    ['1/x', 'ln', 'log', 'eˣ', '10ˣ'],
    ['sin', 'cos', 'tan', angleLabel, '('],
    ['sin⁻¹', 'cos⁻¹', 'tan⁻¹', '(', ')'],
  ]

  const standardButtons = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '−'],
    ['0', '00', '.', '＋'],
  ]

  const handleStandardButton = (btn: string) => {
    switch (btn) {
      case '÷': insertAtCursor('/'); break
      case '×': insertAtCursor('*'); break
      case '−': insertAtCursor('-'); break
      case '＋': insertAtCursor('+'); break
      default: insertAtCursor(btn)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <button
          onClick={() => setShowScientific(!showScientific)}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors bg-accent text-accent-foreground hover:bg-accent/80"
        >
          {showScientific ? '收起科学面板' : '科学面板'}
        </button>
        <button
          onClick={toggleAngleMode}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors bg-accent text-accent-foreground hover:bg-accent/80"
        >
          {angleMode === 'deg' ? 'Deg' : 'Rad'}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-1.5 text-sm rounded-lg transition-colors bg-accent text-accent-foreground hover:bg-accent/80"
        >
          历史记录
        </button>
      </div>

      <div className="p-4 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full text-2xl font-mono bg-transparent outline-none text-foreground placeholder-muted-foreground"
          placeholder="输入公式..."
          autoFocus
        />
        <div className={`text-right text-xl mt-2 font-mono ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
          {error ? error : result ? `= ${result}` : ''}
        </div>
      </div>

      {showScientific && (
        <div className="p-2 border-b border-border bg-card/50">
          {scientificRows.map((row, ri) => (
            <div key={ri} className="flex gap-1 mb-1">
              {row.map((label) => (
                <button
                  key={label}
                  onClick={() => handleScientificButton(label)}
                  className="flex-1 py-2 text-sm rounded-lg transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium"
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 p-2">
        {standardButtons.map((row, ri) => (
          <div key={ri} className="flex gap-1 mb-1">
            {row.map((btn) => (
              <button
                key={btn}
                onClick={() => handleStandardButton(btn)}
                className="flex-1 py-3 text-lg rounded-lg transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium"
              >
                {btn}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-1">
          <button
            onClick={() => insertAtCursor('(')}
            className="flex-1 py-3 text-lg rounded-lg transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium"
          >
            (
          </button>
          <button
            onClick={() => insertAtCursor(')')}
            className="flex-1 py-3 text-lg rounded-lg transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium"
          >
            )
          </button>
          <button
            onClick={backspace}
            className="flex-1 py-3 text-lg rounded-lg transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium"
          >
            ⌫
          </button>
          <button
            onClick={() => {
              if (result && !error) {
                setHistory(prev => [{ expr: expression, result }, ...prev].slice(0, 50))
                setExpression(result.replace(/,/g, ''))
              }
            }}
            className="flex-1 py-3 text-lg rounded-lg transition-colors bg-primary hover:bg-primary/80 text-primary-foreground font-medium"
          >
            ＝
          </button>
        </div>
      </div>

      {showHistory && history.length > 0 && (
        <div className="border-t border-border p-4 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">历史记录</h3>
          {history.map((item, i) => (
            <div
              key={i}
              onClick={() => {
                setExpression(item.result.replace(/,/g, ''))
                setShowHistory(false)
              }}
              className="py-1 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2"
            >
              <span className="text-muted-foreground">{item.expr}</span>
              <span className="text-foreground"> = {item.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
