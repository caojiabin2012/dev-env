import { useState } from 'react'
import { CalculatorPanel } from './calculator-panel'
import { ConverterPanel } from './converter'

type CalculatorTab = 'calculator' | 'converter'

const tabs: { id: CalculatorTab; name: string; icon: string }[] = [
  { id: 'calculator', name: '计算器', icon: '📱' },
  { id: 'converter', name: '换算', icon: '🔄' },
]

export function Calculator() {
  const [activeTab, setActiveTab] = useState<CalculatorTab>('calculator')

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.name}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'calculator' ? <CalculatorPanel /> : <ConverterPanel />}
      </div>
    </div>
  )
}
