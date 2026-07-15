import { useState, useMemo } from 'react'

const taxBrackets = [
  { min: 0, max: 36000, rate: 0.03, deduction: 0 },
  { min: 36000, max: 144000, rate: 0.10, deduction: 2520 },
  { min: 144000, max: 300000, rate: 0.20, deduction: 16920 },
  { min: 300000, max: 420000, rate: 0.25, deduction: 31920 },
  { min: 420000, max: 660000, rate: 0.30, deduction: 52920 },
  { min: 660000, max: 960000, rate: 0.35, deduction: 85920 },
  { min: 960000, max: Infinity, rate: 0.45, deduction: 181920 },
]

interface DeductionItem {
  id: string
  name: string
  icon: string
  monthlyAmount: number
  options?: { label: string; value: number }[]
}

const deductionItems: DeductionItem[] = [
  {
    id: 'child_education',
    name: '子女教育',
    icon: '👶',
    monthlyAmount: 2000,
  },
  {
    id: 'infant_care',
    name: '3岁以下婴幼儿照护',
    icon: '🍼',
    monthlyAmount: 2000,
  },
  {
    id: 'continue_education',
    name: '继续教育',
    icon: '📚',
    monthlyAmount: 400,
    options: [
      { label: '学历教育 (400元/月)', value: 400 },
      { label: '职业资格 (3600元/年)', value: 300 },
    ],
  },
  {
    id: 'housing_loan',
    name: '住房贷款利息',
    icon: '🏠',
    monthlyAmount: 1000,
  },
  {
    id: 'housing_rent',
    name: '住房租金',
    icon: '🏢',
    monthlyAmount: 1500,
    options: [
      { label: '直辖市/省会/计划单列市 (1500元/月)', value: 1500 },
      { label: '其他城市 (1100元/月)', value: 1100 },
      { label: '县级市 (800元/月)', value: 800 },
    ],
  },
  {
    id: 'support_parent',
    name: '赡养老人',
    icon: '👴',
    monthlyAmount: 3000,
    options: [
      { label: '独生子女 (3000元/月)', value: 3000 },
      { label: '非独生子女-最高 (1500元/月)', value: 1500 },
    ],
  },
  {
    id: 'serious_illness',
    name: '大病医疗',
    icon: '🏥',
    monthlyAmount: 0,
    options: [
      { label: '无', value: 0 },
      { label: '10000元/年', value: 833 },
      { label: '20000元/年', value: 1667 },
      { label: '30000元/年', value: 2500 },
      { label: '40000元/年', value: 3333 },
      { label: '50000元/年', value: 4167 },
      { label: '60000元/年', value: 5000 },
      { label: '70000元/年', value: 5833 },
      { label: '80000元/年 (上限)', value: 6667 },
    ],
  },
]

function formatCurrency(num: number): string {
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calculateTax(taxableIncome: number): number {
  let tax = 0
  for (const b of taxBrackets) {
    if (taxableIncome > b.min) {
      tax = taxableIncome * b.rate - b.deduction
    }
  }
  return Math.max(0, tax)
}

function getBracket(taxableIncome: number) {
  for (const b of taxBrackets) {
    if (taxableIncome > b.min && taxableIncome <= b.max) {
      return b
    }
  }
  return taxBrackets[taxBrackets.length - 1]
}

export function TaxCalculator() {
  const [monthlyIncome, setMonthlyIncome] = useState('20000')
  const [socialInsurance, setSocialInsurance] = useState('3000')
  const [deductions, setDeductions] = useState<Record<string, { enabled: boolean; value: number }>>({
    child_education: { enabled: false, value: 2000 },
    infant_care: { enabled: false, value: 2000 },
    continue_education: { enabled: false, value: 400 },
    housing_loan: { enabled: false, value: 1000 },
    housing_rent: { enabled: false, value: 1500 },
    support_parent: { enabled: false, value: 3000 },
    serious_illness: { enabled: false, value: 0 },
  })
  const [childCount, setChildCount] = useState('1')
  const [infantCount, setInfantCount] = useState('1')

  const income = parseFloat(monthlyIncome) || 0
  const social = parseFloat(socialInsurance) || 0
  const children = parseInt(childCount) || 0
  const infants = parseInt(infantCount) || 0

  const result = useMemo(() => {
    const annualIncome = income * 12
    const annualSocial = social * 12
    const annualDeduction = 60000

    let monthlySpecial = 0
    const deductionDetails: { name: string; icon: string; monthly: number; annual: number }[] = []

    for (const item of deductionItems) {
      const d = deductions[item.id]
      if (d?.enabled && d.value > 0) {
        let monthly = d.value
        if (item.id === 'child_education') {
          monthly = d.value * children
        } else if (item.id === 'infant_care') {
          monthly = d.value * infants
        } else if (item.id === 'serious_illness') {
          monthly = d.value
        }
        monthlySpecial += monthly
        deductionDetails.push({
          name: item.name,
          icon: item.icon,
          monthly,
          annual: monthly * 12,
        })
      }
    }

    const annualSpecial = monthlySpecial * 12

    const taxableIncomeWithDeduction = Math.max(0, annualIncome - annualSocial - annualSpecial - annualDeduction)
    const taxableIncomeWithoutDeduction = Math.max(0, annualIncome - annualSocial - annualDeduction)

    const taxWithDeduction = calculateTax(taxableIncomeWithDeduction)
    const taxWithoutDeduction = calculateTax(taxableIncomeWithoutDeduction)

    const taxSaved = taxWithoutDeduction - taxWithDeduction

    return {
      annualIncome,
      annualSocial,
      annualSpecial,
      annualDeduction,
      monthlySpecial,
      taxableIncomeWithDeduction,
      taxableIncomeWithoutDeduction,
      bracket: getBracket(taxableIncomeWithDeduction),
      bracketWithout: getBracket(taxableIncomeWithoutDeduction),
      annualTax: taxWithDeduction,
      monthlyTax: taxWithDeduction / 12,
      annualTaxWithout: taxWithoutDeduction,
      monthlyTaxWithout: taxWithoutDeduction / 12,
      taxSaved,
      monthlyTaxSaved: taxSaved / 12,
      deductionDetails,
      annualNet: annualIncome - annualSocial - annualSpecial - taxWithDeduction,
      monthlyNet: (annualIncome - annualSocial - annualSpecial - taxWithDeduction) / 12,
    }
  }, [income, social, deductions, children, infants])

  const toggleDeduction = (id: string) => {
    setDeductions((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        enabled: !prev[id].enabled,
      },
    }))
  }

  const updateDeductionValue = (id: string, value: number) => {
    setDeductions((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        value,
      },
    }))
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">月收入（元）</label>
          <input
            type="text"
            inputMode="decimal"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">五险一金（元/月）</label>
          <input
            type="text"
            inputMode="decimal"
            value={socialInsurance}
            onChange={(e) => setSocialInsurance(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">专项附加扣除</div>
        <div className="space-y-3">
          {deductionItems.map((item) => {
            const d = deductions[item.id]
            const isChildOrInfant = item.id === 'child_education' || item.id === 'infant_care'

            return (
              <div key={item.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <button
                    onClick={() => toggleDeduction(item.id)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      d?.enabled ? 'bg-primary' : 'bg-secondary'
                    }`}
                  >
                    <div
                      className={`absolute w-5 h-5 rounded-full bg-white shadow-md top-0.5 transition-transform ${
                        d?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {d?.enabled && (
                  <div className="mt-2 space-y-2">
                    {isChildOrInfant && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          数量
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (item.id === 'child_education') setChildCount('1')
                              else setInfantCount('1')
                            }}
                            className={`px-3 py-1 rounded text-sm ${
                              (item.id === 'child_education' ? childCount : infantCount) === '1'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            1个
                          </button>
                          <button
                            onClick={() => {
                              if (item.id === 'child_education') setChildCount('2')
                              else setInfantCount('2')
                            }}
                            className={`px-3 py-1 rounded text-sm ${
                              (item.id === 'child_education' ? childCount : infantCount) === '2'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            2个
                          </button>
                          <button
                            onClick={() => {
                              if (item.id === 'child_education') setChildCount('3')
                              else setInfantCount('3')
                            }}
                            className={`px-3 py-1 rounded text-sm ${
                              (item.id === 'child_education' ? childCount : infantCount) === '3'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            3个
                          </button>
                        </div>
                      </div>
                    )}

                    {item.options && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">类型</label>
                        <div className="flex flex-wrap gap-2">
                          {item.options.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updateDeductionValue(item.id, opt.value)}
                              className={`px-2 py-1 rounded text-xs ${
                                d.value === opt.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-secondary-foreground'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between text-sm pt-1 border-t border-border">
                      <span className="text-muted-foreground">每月扣除</span>
                      <span className="font-mono text-primary">
                        {formatCurrency(item.id === 'child_education'
                          ? d.value * children
                          : item.id === 'infant_care'
                          ? d.value * infants
                          : d.value
                        )}元
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {result.deductionDetails.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">专项附加扣除合计</span>
              <span className="font-mono font-medium text-primary">
                {formatCurrency(result.monthlySpecial)}元/月 = {formatCurrency(result.annualSpecial)}元/年
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">计算结果</div>
        <div className="space-y-3">
          <div className="text-center py-3 bg-primary/5 rounded-lg">
            <div className="text-sm text-muted-foreground">每月应缴个税</div>
            <div className="text-3xl font-mono text-primary">
              ¥{formatCurrency(result.monthlyTax)}
            </div>
          </div>

          {result.taxSaved > 0 && (
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                扣除后每月少缴
              </div>
              <div className="text-2xl font-mono text-green-600 dark:text-green-400">
                ¥{formatCurrency(result.monthlyTaxSaved)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                年度合计节省 ¥{formatCurrency(result.taxSaved)}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">年度应纳税所得额</span>
              <span className="font-mono">{formatCurrency(result.taxableIncomeWithDeduction)}元</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">适用税率</span>
              <span>{(result.bracket.rate * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">速算扣除数</span>
              <span className="font-mono">{formatCurrency(result.bracket.deduction)}元</span>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">年度个税</span>
              <span className="font-mono text-destructive">{formatCurrency(result.annualTax)}元</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">年度税后收入</span>
              <span className="font-mono text-primary">{formatCurrency(result.annualNet)}元</span>
            </div>
          </div>
        </div>
      </div>

      {result.taxSaved > 0 && (
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-sm font-medium text-muted-foreground mb-3">扣除前后对比</div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground font-medium">
              <span></span>
              <span className="text-center">有扣除</span>
              <span className="text-center">无扣除</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-muted-foreground">应纳税所得额</span>
              <span className="text-center font-mono">{formatCurrency(result.taxableIncomeWithDeduction)}</span>
              <span className="text-center font-mono">{formatCurrency(result.taxableIncomeWithoutDeduction)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-muted-foreground">适用税率</span>
              <span className="text-center">{(result.bracket.rate * 100).toFixed(0)}%</span>
              <span className="text-center">{(result.bracketWithout.rate * 100).toFixed(0)}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-muted-foreground">月缴个税</span>
              <span className="text-center font-mono text-primary">¥{formatCurrency(result.monthlyTax)}</span>
              <span className="text-center font-mono text-destructive">¥{formatCurrency(result.monthlyTaxWithout)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-muted-foreground">年度个税</span>
              <span className="text-center font-mono text-primary">¥{formatCurrency(result.annualTax)}</span>
              <span className="text-center font-mono text-destructive">¥{formatCurrency(result.annualTaxWithout)}</span>
            </div>
            <div className="border-t border-border pt-2 grid grid-cols-3 gap-2 text-sm font-medium">
              <span>年度节省</span>
              <span className="col-span-2 text-center text-green-600 dark:text-green-400">
                ¥{formatCurrency(result.taxSaved)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">税率表</div>
        <div className="text-xs">
          <div className="grid grid-cols-4 gap-2 font-medium text-muted-foreground mb-2">
            <span>级距</span>
            <span>税率</span>
            <span>速算扣除数</span>
            <span>应纳税所得额</span>
          </div>
          {taxBrackets.slice(0, -1).map((b, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 py-1 border-b border-border">
              <span>{i + 1}</span>
              <span>{(b.rate * 100).toFixed(0)}%</span>
              <span className="font-mono">{b.deduction.toLocaleString()}</span>
              <span className="font-mono">
                {b.min.toLocaleString()}-{b.max.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">专项附加扣除标准（2024年）</div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 子女教育：每个子女 2000元/月</p>
          <p>• 3岁以下婴幼儿照护：每个婴幼儿 2000元/月</p>
          <p>• 继续教育：学历教育 400元/月，职业资格 3600元/年</p>
          <p>• 住房贷款利息：1000元/月（最长240个月）</p>
          <p>• 住房租金：800-1500元/月（按城市）</p>
          <p>• 赡养老人：独生子女 3000元/月，非独生最高 1500元/月</p>
          <p>• 大病医疗：每年最高 80000元（限额扣除）</p>
        </div>
      </div>
    </div>
  )
}
