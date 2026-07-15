import { useState } from 'react'
import { LengthConverter } from './length-converter'
import { WeightConverter } from './weight-converter'
import { AreaConverter } from './area-converter'
import { VolumeConverter } from './volume-converter'
import { TemperatureConverter } from './temperature-converter'
import { SpeedConverter } from './speed-converter'
import { TimeConverter } from './time-converter'
import { DataConverter } from './data-converter'
import { BaseConverter } from './base-converter'
import { ChineseNumberConverter } from './chinese-number'
import { TaxCalculator } from './tax-calculator'
import { LoanCalculator } from './loan-calculator'
import { DepositCalculator } from './deposit-calculator'
import { CurrencyConverter } from './currency-converter'
import { KinshipConverter } from './kinship-converter'
import { BmiCalculator } from './bmi-calculator'

type ConverterType =
  | 'currency'
  | 'length'
  | 'weight'
  | 'area'
  | 'volume'
  | 'temperature'
  | 'speed'
  | 'time'
  | 'data'
  | 'base'
  | 'chinese'
  | 'tax'
  | 'loan'
  | 'deposit'
  | 'kinship'
  | 'bmi'

const converterTypes: { id: ConverterType; name: string; icon: string }[] = [
  { id: 'currency', name: '汇率', icon: '💱' },
  { id: 'length', name: '长度', icon: '📏' },
  { id: 'weight', name: '重量', icon: '⚖️' },
  { id: 'area', name: '面积', icon: '📐' },
  { id: 'volume', name: '体积', icon: '📦' },
  { id: 'temperature', name: '温度', icon: '🌡️' },
  { id: 'speed', name: '速度', icon: '🚀' },
  { id: 'time', name: '时间', icon: '⏰' },
  { id: 'data', name: '数据', icon: '💾' },
  { id: 'base', name: '进制', icon: '🔢' },
  { id: 'chinese', name: '大写', icon: '🔤' },
  { id: 'tax', name: '个税', icon: '💰' },
  { id: 'loan', name: '房贷', icon: '🏠' },
  { id: 'deposit', name: '存款', icon: '🏦' },
  { id: 'kinship', name: '称呼', icon: '👨‍👩‍👧‍👦' },
  { id: 'bmi', name: 'BMI', icon: '💪' },
]

export function ConverterPanel() {
  const [activeType, setActiveType] = useState<ConverterType>('currency')

  const renderConverter = () => {
    switch (activeType) {
      case 'currency':
        return <CurrencyConverter key="currency" />
      case 'length':
        return <LengthConverter key="length" />
      case 'weight':
        return <WeightConverter key="weight" />
      case 'area':
        return <AreaConverter key="area" />
      case 'volume':
        return <VolumeConverter key="volume" />
      case 'temperature':
        return <TemperatureConverter key="temperature" />
      case 'speed':
        return <SpeedConverter key="speed" />
      case 'time':
        return <TimeConverter key="time" />
      case 'data':
        return <DataConverter key="data" />
      case 'base':
        return <BaseConverter key="base" />
      case 'chinese':
        return <ChineseNumberConverter key="chinese" />
      case 'tax':
        return <TaxCalculator key="tax" />
      case 'loan':
        return <LoanCalculator key="loan" />
      case 'deposit':
        return <DepositCalculator key="deposit" />
      case 'kinship':
        return <KinshipConverter key="kinship" />
      case 'bmi':
        return <BmiCalculator key="bmi" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {converterTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                activeType === type.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <span>{type.icon}</span>
              <span>{type.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {renderConverter()}
      </div>
    </div>
  )
}
