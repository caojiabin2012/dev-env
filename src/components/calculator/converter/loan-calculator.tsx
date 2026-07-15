import { useState, useMemo } from 'react'

type LoanType = 'equal_installment' | 'equal_principal'

function formatCurrency(num: number): string {
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function LoanCalculator() {
  const [loanType, setLoanType] = useState<LoanType>('equal_installment')
  const [loanAmount, setLoanAmount] = useState('100')
  const [loanYears, setLoanYears] = useState('30')
  const [annualRate, setAnnualRate] = useState('3.1')

  const amount = (parseFloat(loanAmount) || 0) * 10000
  const years = parseFloat(loanYears) || 0
  const months = years * 12
  const rate = (parseFloat(annualRate) || 0) / 100
  const monthRate = rate / 12

  const result = useMemo(() => {
    if (amount <= 0 || months <= 0 || monthRate <= 0) {
      return {
        monthlyPayment: 0,
        totalInterest: 0,
        totalPayment: 0,
        schedule: [],
      }
    }

      const schedule: { year: number; principal: number; interest: number; remaining: number }[] = []

    if (loanType === 'equal_installment') {
      const monthlyPayment =
        (amount * monthRate * Math.pow(1 + monthRate, months)) /
        (Math.pow(1 + monthRate, months) - 1)
      const totalPayment = monthlyPayment * months
      const totalInterest = totalPayment - amount

      let remaining = amount
      for (let year = 1; year <= years; year++) {
        let yearPrincipal = 0
        let yearInterest = 0
        for (let m = 0; m < 12; m++) {
          const interest = remaining * monthRate
          const principal = monthlyPayment - interest
          yearPrincipal += principal
          yearInterest += interest
          remaining -= principal
        }
        schedule.push({
          year,
          principal: yearPrincipal,
          interest: yearInterest,
          remaining: Math.max(0, remaining),
        })
      }

      return {
        monthlyPayment,
        totalInterest,
        totalPayment,
        schedule,
      }
    } else {
      const monthlyPrincipal = amount / months
      let remaining = amount
      let totalInterest = 0
      let firstMonthPayment = 0

      for (let year = 1; year <= years; year++) {
        let yearPrincipal = 0
        let yearInterest = 0
        for (let m = 0; m < 12; m++) {
          const interest = remaining * monthRate
          if (year === 1 && m === 0) {
            firstMonthPayment = monthlyPrincipal + interest
          }
          yearPrincipal += monthlyPrincipal
          yearInterest += interest
          totalInterest += interest
          remaining -= monthlyPrincipal
        }
        schedule.push({
          year,
          principal: yearPrincipal,
          interest: yearInterest,
          remaining: Math.max(0, remaining),
        })
      }

      return {
        monthlyPayment: firstMonthPayment,
        totalInterest,
        totalPayment: amount + totalInterest,
        schedule,
      }
    }
  }, [amount, months, monthRate, loanType, years])

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-3">还款方式</div>
        <div className="flex gap-2">
          <button
            onClick={() => setLoanType('equal_installment')}
            className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
              loanType === 'equal_installment'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            等额本息
          </button>
          <button
            onClick={() => setLoanType('equal_principal')}
            className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
              loanType === 'equal_principal'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            等额本金
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">贷款总额（万元）</label>
          <input
            type="text"
            inputMode="decimal"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={parseFloat(loanAmount) || 100}
            onChange={(e) => setLoanAmount(e.target.value)}
            className="w-full mt-2"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">贷款年限（年）</label>
          <input
            type="text"
            inputMode="decimal"
            value={loanYears}
            onChange={(e) => setLoanYears(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={parseFloat(loanYears) || 30}
            onChange={(e) => setLoanYears(e.target.value)}
            className="w-full mt-2"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">年利率（%）</label>
          <input
            type="text"
            inputMode="decimal"
            value={annualRate}
            onChange={(e) => setAnnualRate(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
          <input
            type="range"
            min="1"
            max="10"
            step="0.1"
            value={parseFloat(annualRate) || 3.1}
            onChange={(e) => setAnnualRate(e.target.value)}
            className="w-full mt-2"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">计算结果</div>
        <div className="space-y-3">
          <div className="text-center py-2">
            <div className="text-sm text-muted-foreground">每月还款</div>
            <div className="text-3xl font-mono text-primary">
              ¥{formatCurrency(result.monthlyPayment)}
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">支付利息</span>
              <span className="font-mono">¥{formatCurrency(result.totalInterest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">还款总额</span>
              <span className="font-mono">¥{formatCurrency(result.totalPayment)}</span>
            </div>
          </div>
        </div>
      </div>

      {result.schedule.length > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-sm font-medium text-muted-foreground mb-3">还款计划</div>
          <div className="text-xs max-h-64 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 font-medium text-muted-foreground mb-2 sticky top-0 bg-card">
              <span>年份</span>
              <span>本金</span>
              <span>利息</span>
              <span>剩余</span>
            </div>
            {result.schedule.map((item) => (
              <div key={item.year} className="grid grid-cols-4 gap-2 py-1 border-b border-border">
                <span>第{item.year}年</span>
                <span className="font-mono">{formatCurrency(item.principal)}</span>
                <span className="font-mono">{formatCurrency(item.interest)}</span>
                <span className="font-mono">{formatCurrency(item.remaining)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
