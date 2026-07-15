import { useState } from 'react'

type Base = 2 | 8 | 10 | 16

const bases: { id: Base; name: string; prefix: string }[] = [
  { id: 2, name: '二进制', prefix: 'BIN' },
  { id: 8, name: '八进制', prefix: 'OCT' },
  { id: 10, name: '十进制', prefix: 'DEC' },
  { id: 16, name: '十六进制', prefix: 'HEX' },
]

function formatResult(num: number, base: Base): string {
  if (!isFinite(num) || isNaN(num)) return 'Error'
  const result = num.toString(base).toUpperCase()
  if (base === 16) return '0x' + result
  if (base === 2) return '0b' + result
  if (base === 8) return '0o' + result
  return result
}

export function BaseConverter() {
  const [inputValue, setInputValue] = useState('255')
  const [inputBase, setInputBase] = useState<Base>(10)

  const parseValue = (): number => {
    try {
      let cleaned = inputValue.trim()
      if (inputBase === 16) {
        cleaned = cleaned.replace(/^0x/i, '')
      } else if (inputBase === 2) {
        cleaned = cleaned.replace(/^0b/i, '')
      } else if (inputBase === 8) {
        cleaned = cleaned.replace(/^0o/i, '')
      }
      return parseInt(cleaned, inputBase)
    } catch {
      return NaN
    }
  }

  const numValue = parseValue()

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-2">输入值</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 text-2xl font-mono bg-transparent outline-none text-foreground"
            placeholder="输入数字..."
          />
          <select
            value={inputBase}
            onChange={(e) => setInputBase(Number(e.target.value) as Base)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {bases.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {bases.map((base) => (
          <div key={base.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{base.name}</div>
              <div className="text-xs text-muted-foreground">{base.prefix}</div>
            </div>
            <div className="text-lg font-mono text-foreground">
              {isNaN(numValue) ? 'Error' : formatResult(numValue, base.id)}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">ASCII 字符</div>
        <div className="text-center text-lg font-mono">
          {isNaN(numValue) || numValue < 0 || numValue > 127
            ? '非可打印字符'
            : String.fromCharCode(numValue)}
        </div>
      </div>
    </div>
  )
}
