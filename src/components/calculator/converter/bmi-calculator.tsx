import { useState, useMemo } from 'react'

function getBmiCategory(bmi: number): { label: string; color: string; advice: string } {
  if (bmi < 18.5) {
    return {
      label: '偏瘦',
      color: 'text-blue-500',
      advice: '体重偏轻，建议适当增加营养摄入，进行适量力量训练。',
    }
  } else if (bmi < 24) {
    return {
      label: '正常',
      color: 'text-green-500',
      advice: '体重正常，请继续保持健康的生活方式。',
    }
  } else if (bmi < 28) {
    return {
      label: '偏胖',
      color: 'text-yellow-500',
      advice: '体重偏重，建议控制饮食，增加有氧运动。',
    }
  } else {
    return {
      label: '肥胖',
      color: 'text-red-500',
      advice: '体重过重，建议咨询医生，制定科学的减重计划。',
    }
  }
}

function getBmiPosition(bmi: number): number {
  if (bmi < 16) return 0
  if (bmi > 32) return 100
  return ((bmi - 16) / 16) * 100
}

export function BmiCalculator() {
  const [height, setHeight] = useState('175')
  const [weight, setWeight] = useState('70')

  const heightNum = parseFloat(height) || 0
  const weightNum = parseFloat(weight) || 0

  const result = useMemo(() => {
    if (heightNum <= 0 || weightNum <= 0) {
      return {
        bmi: 0,
        category: { label: '请输入身高和体重', color: 'text-muted-foreground', advice: '' },
        standardWeight: 0,
        position: 0,
      }
    }

    const heightM = heightNum / 100
    const bmi = weightNum / (heightM * heightM)
    const category = getBmiCategory(bmi)
    const standardWeight = heightM * heightM * 22
    const position = getBmiPosition(bmi)

    return {
      bmi,
      category,
      standardWeight,
      position,
    }
  }, [heightNum, weightNum])

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">身高（cm）</label>
          <input
            type="text"
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">体重（kg）</label>
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full text-xl font-mono bg-transparent outline-none text-foreground"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-primary mb-2">
            {result.bmi > 0 ? result.bmi.toFixed(2) : '--'}
          </div>
          <div className={`text-xl font-medium ${result.category.color}`}>
            {result.category.label}
          </div>
        </div>

        <div className="mt-4">
          <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500 relative">
            <div
              className="absolute w-4 h-4 rounded-full bg-white border-2 border-foreground shadow-md -mt-0.5"
              style={{ left: `calc(${result.position}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>偏瘦</span>
            <span>正常</span>
            <span>偏胖</span>
            <span>肥胖</span>
          </div>
        </div>

        {result.category.advice && (
          <div className="mt-4 p-3 rounded-lg bg-secondary text-sm text-secondary-foreground">
            {result.category.advice}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">详细信息</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">标准体重</span>
            <span className="font-mono">{result.standardWeight.toFixed(1)} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">当前体重</span>
            <span className="font-mono">{weightNum} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">体重差</span>
            <span className={`font-mono ${weightNum > result.standardWeight ? 'text-destructive' : 'text-green-500'}`}>
              {weightNum > result.standardWeight ? '+' : ''}{(weightNum - result.standardWeight).toFixed(1)} kg
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">BMI 分类标准</div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between py-1">
            <span className="text-blue-500">偏瘦</span>
            <span className="text-muted-foreground">BMI {'<'} 18.5</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-green-500">正常</span>
            <span className="text-muted-foreground">18.5 ≤ BMI {'<'} 24</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-yellow-500">偏胖</span>
            <span className="text-muted-foreground">24 ≤ BMI {'<'} 28</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-red-500">肥胖</span>
            <span className="text-muted-foreground">BMI ≥ 28</span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">BMI 计算公式</div>
        <div className="text-xs text-muted-foreground">
          <p className="mb-2">BMI = 体重(kg) ÷ 身高(m)²</p>
          <p>例如：身高 175cm，体重 70kg</p>
          <p className="font-mono">BMI = 70 ÷ (1.75)² = 70 ÷ 3.0625 = 22.86</p>
        </div>
      </div>
    </div>
  )
}
