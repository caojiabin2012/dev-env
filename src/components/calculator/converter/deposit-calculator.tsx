import { useState, useMemo } from 'react'

type DepositType = 'lump_sum' | 'regular'

const depositRates: Record<string, number> = {
  '3m': 0.015,
  '6m': 0.017,
  '1y': 0.019,
  '2y': 0.0235,
  '3y': 0.0275,
  '5y': 0.0285,
}

const depositTerms: { id: string; name: string; years: number }[] = [
  { id: '3m', name: '3个月', years: 0.25 },
  { id: '6m', name: '6个月', years: 0.5 },
  { id: '1y', name: '1年', years: 1 },
  { id: '2y', name: '2年', years: 2 },
  { id: '3y', name: '3年', years: 3 },
  { id: '5y', name: '5年', years: 5 },
]

function formatCurrency(num: number): string {
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function DepositCalculator() {
  const [depositType, setDepositType] = useState<DepositType>('lump_sum')
  const [amount, setAmount] = useState('50000')
  const [term, setTerm] = useState('1y')
  const [rate, setRate] = useState((depositRates['1y'] * 100).toString())
  const [monthlyAmount, setMonthlyAmount] = useState('1000')

  const principal = parseFloat(amount) || 0
  const annualRate = (parseFloat(rate) || 0) / 100
  const termInfo = depositTerms.find((t) => t.id === term)!
  const years = termInfo.years

  const monthlyDeposit = parseFloat(monthlyAmount) || 0

  const result = useMemo(() => {
    if (depositType === 'lump_sum') {
      const interest = principal * annualRate * years
      return {
        interest,
        total: principal + interest,
        dailyRate: annualRate / 365,
        effectiveRate: annualRate,
      }
    } else {
      let totalPrincipal = 0
      let totalInterest = 0
      const totalMonths = Math.round(years * 12)

      for (let i = 0; i < totalMonths; i++) {
        const remainingMonths = totalMonths - i
        const depositYears = remainingMonths / 12
        const interest = monthlyDeposit * annualRate * depositYears
        totalInterest += interest
        totalPrincipal += monthlyDeposit
      }

      return {
        interest: totalInterest,
        total: totalPrincipal + totalInterest,
        dailyRate: annualRate / 365,
        effectiveRate: annualRate,
      }
    }
  }, [depositType, principal, annualRate, years, monthlyDeposit])

  const comparisonData = useMemo(() => {
    return depositTerms.map((t) => {
      const rate = depositRates[t.id]
      let interest: number
      if (depositType === 'lump_sum') {
        interest = principal * rate * t.years
      } else {
        let totalInterest = 0
        const totalMonths = Math.round(t.years * 12)
        for (let i = 0; i < totalMonths; i++) {
          const remainingMonths = totalMonths - i
          const depositYears = remainingMonths / 12
          totalInterest += monthlyDeposit * rate * depositYears
        }
        interest = totalInterest
      }
      return {
        term: t.name,
        rate: rate,
        interest,
        total: depositType === 'lump_sum' ? principal + interest : monthlyDeposit * Math.round(t.years * 12) + interest,
      }
    })
  }, [depositType, principal, monthlyDeposit])

  const handleTermChange = (newTerm: string) => {
    setTerm(newTerm)
    setRate((depositRates[newTerm] * 100).toString())
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-3">存款类型</div>
        <div className="flex gap-2">
          <button
            onClick={() => setDepositType('lump_sum')}
            className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
              depositType === 'lump_sum'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            整存整取
          </button>
          <button
            onClick={() => setDepositType('regular')}
            className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
              depositType === 'regular'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            零存整取
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border space-y-4">
        {depositType === 'lump_sum' ? (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">存入金额（元）</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
            />
          </div>
        ) : (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">每月存入（元）</label>
            <input
              type="text"
              inputMode="decimal"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
            />
          </div>
        )}

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">存期</label>
          <div className="flex flex-wrap gap-2">
            {depositTerms.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTermChange(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  term === t.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">年利率（%）</label>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">计算结果</div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">利息收入</span>
            <span className="font-mono text-primary">¥{formatCurrency(result.interest)}</span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">到期本息合计</span>
              <span className="font-mono text-lg text-primary">¥{formatCurrency(result.total)}</span>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">日利率</span>
              <span className="font-mono">{(result.dailyRate * 100).toFixed(4)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">实际年化收益</span>
              <span className="font-mono">{(result.effectiveRate * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">利息对比</div>
        <div className="text-xs max-h-48 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2 font-medium text-muted-foreground mb-2 sticky top-0 bg-card">
            <span>存期</span>
            <span>利率</span>
            <span>利息</span>
            <span>到期额</span>
          </div>
          {comparisonData.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-2 py-1 border-b border-border"
            >
              <span>{item.term}</span>
              <span>{(item.rate * 100).toFixed(2)}%</span>
              <span className="font-mono">{formatCurrency(item.interest)}</span>
              <span className="font-mono">{formatCurrency(item.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
