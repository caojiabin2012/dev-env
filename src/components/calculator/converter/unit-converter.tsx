import { useState } from 'react'
import { type UnitGroup, convert } from '../utils/units'
import { formatResult } from '../utils/format'

interface UnitConverterProps {
  group: UnitGroup
}

export function UnitConverter({ group }: UnitConverterProps) {
  const [inputValue, setInputValue] = useState('1')
  const [fromId, setFromId] = useState(group.units[0].id)
  const [toId, setToId] = useState(group.units[1]?.id || group.units[0].id)

  const fromUnit = group.units.find(u => u.id === fromId) ?? group.units[0]
  const toUnit = group.units.find(u => u.id === toId) ?? group.units[0]
  const numericValue = parseFloat(inputValue) || 0
  const result = convert(numericValue, fromUnit, toUnit, group.id)

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
            value={fromUnit.id}
            onChange={(e) => setFromId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {group.units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => {
            setFromId(toUnit.id)
            setToId(fromUnit.id)
            setInputValue(formatResult(result))
          }}
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
            value={toUnit.id}
            onChange={(e) => setToId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {group.units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">换算表</div>
        <div className="space-y-2">
          {group.units.map((unit) => {
            const converted = convert(1, fromUnit, unit, group.id)
            return (
              <div key={unit.id} className="flex justify-between py-1 border-b border-border last:border-0">
                <span className="text-muted-foreground">1 {fromUnit.symbol}</span>
                <span className="text-foreground font-mono">{formatResult(converted)} {unit.symbol}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

