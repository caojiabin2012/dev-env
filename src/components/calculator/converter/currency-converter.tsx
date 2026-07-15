import { useState } from 'react'

interface Currency {
  id: string
  name: string
  symbol: string
  rate: number
}

const currencies: Currency[] = [
  { id: 'CNY', name: '人民币', symbol: '¥', rate: 1 },
  { id: 'USD', name: '美元', symbol: '$', rate: 0.1351 },
  { id: 'EUR', name: '欧元', symbol: '€', rate: 0.1247 },
  { id: 'GBP', name: '英镑', symbol: '£', rate: 0.1067 },
  { id: 'JPY', name: '日元', symbol: '¥', rate: 20.52 },
  { id: 'KRW', name: '韩元', symbol: '₩', rate: 185.67 },
  { id: 'HKD', name: '港币', symbol: 'HK$', rate: 1.054 },
  { id: 'TWD', name: '新台币', symbol: 'NT$', rate: 4.32 },
  { id: 'SGD', name: '新加坡元', symbol: 'S$', rate: 0.182 },
  { id: 'AUD', name: '澳元', symbol: 'A$', rate: 0.208 },
  { id: 'CAD', name: '加元', symbol: 'C$', rate: 0.185 },
  { id: 'CHF', name: '瑞士法郎', symbol: 'Fr', rate: 0.121 },
]

function formatCurrency(num: number): string {
  if (!isFinite(num)) return 'Error'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CurrencyConverter() {
  const [inputValue, setInputValue] = useState('1000')
  const [fromCurrency, setFromCurrency] = useState('CNY')
  const [toCurrency, setToCurrency] = useState('USD')

  const numericValue = parseFloat(inputValue) || 0
  const from = currencies.find((c) => c.id === fromCurrency)!
  const to = currencies.find((c) => c.id === toCurrency)!

  const result = (numericValue / from.rate) * to.rate

  const swap = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
    setInputValue(formatCurrency(result))
  }

  const rates = currencies.map((c) => ({
    ...c,
    converted: (1 / from.rate) * c.rate,
  }))

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-2">输入金额</div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
            className="flex-1 text-2xl font-mono bg-transparent outline-none text-foreground"
          />
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.symbol})
              </option>
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
            {to.symbol}{formatCurrency(result)}
          </div>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground outline-none"
          >
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">汇率表</div>
        <div className="text-xs max-h-48 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 font-medium text-muted-foreground mb-2 sticky top-0 bg-card">
            <span>货币</span>
            <span>汇率</span>
            <span>兑换</span>
          </div>
          {rates.map((c) => (
            <div
              key={c.id}
              onClick={() => setToCurrency(c.id)}
              className={`grid grid-cols-3 gap-2 py-2 border-b border-border cursor-pointer hover:bg-accent/50 ${
                c.id === toCurrency ? 'bg-accent/30' : ''
              }`}
            >
              <span>{c.name}</span>
              <span className="font-mono">{c.rate.toFixed(4)}</span>
              <span className="font-mono">{c.symbol}{formatCurrency(c.converted)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-2">提示</div>
        <div className="text-xs text-muted-foreground">
          汇率数据仅供参考，实际交易请以银行牌价为准。汇率更新时间：2025年1月。
        </div>
      </div>
    </div>
  )
}
