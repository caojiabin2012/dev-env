import { useState } from 'react'
import { formatResult } from '../utils/format'

type TempUnit = 'c' | 'f' | 'k'

const tempUnits: { id: TempUnit; name: string; symbol: string }[] = [
  { id: 'c', name: '摄氏度', symbol: '°C' },
  { id: 'f', name: '华氏度', symbol: '°F' },
  { id: 'k', name: '开尔文', symbol: 'K' },
]

function convertTemp(value: number, from: TempUnit, to: TempUnit): number {
  let celsius: number

  switch (from) {
    case 'c':
      celsius = value
      break
    case 'f':
      celsius = (value - 32) * (5 / 9)
      break
    case 'k':
      celsius = value - 273.15
      break
  }

  switch (to) {
    case 'c':
      return celsius
    case 'f':
      return celsius * (9 / 5) + 32
    case 'k':
      return celsius + 273.15
  }
}

export function TemperatureConverter() {
  const [inputValue, setInputValue] = useState('100')
  const [fromUnit, setFromUnit] = useState<TempUnit>('c')
  const [toUnit, setToUnit] = useState<TempUnit>('f')

  const numericValue = parseFloat(inputValue) || 0
  const result = convertTemp(numericValue, fromUnit, toUnit)

  const swap = () => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
    setInputValue(formatResult(result))
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-2">输入值</div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
            className="flex-1 text-2xl font-mono bg-transparent outline-none text-foreground"
          />
          <select
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value as TempUnit)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {tempUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={swap}
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
        >
          ⇅
        </button>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-2">结果</div>
        <div className="flex gap-2">
          <div className="flex-1 text-2xl font-mono text-primary">
            {formatResult(result)}
          </div>
          <select
            value={toUnit}
            onChange={(e) => setToUnit(e.target.value as TempUnit)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {tempUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">常用温度</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">水的沸点</span>
            <span>100°C = 212°F = 373.15K</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">水的冰点</span>
            <span>0°C = 32°F = 273.15K</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">体温</span>
            <span>37°C = 98.6°F = 310.15K</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">绝对零度</span>
            <span>-273.15°C = -459.67°F = 0K</span>
          </div>
        </div>
      </div>
    </div>
  )
}
