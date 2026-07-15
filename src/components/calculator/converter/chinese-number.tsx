import { useState } from 'react'

const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const units = ['', '拾', '佰', '仟']
const bigUnits = ['', '万', '亿', '兆']

function toChineseUpper(num: number): string {
  if (num === 0) return '零元整'
  if (num < 0) return '负' + toChineseUpper(-num)

  const intPart = Math.floor(num)
  const decPart = Math.round((num - intPart) * 100)

  let result = ''

  if (intPart > 0) {
    result = intPartToString(intPart) + '元'
  }

  if (decPart === 0) {
    result += '整'
  } else {
    const jiao = Math.floor(decPart / 10)
    const fen = decPart % 10
    if (jiao > 0) result += digits[jiao] + '角'
    if (fen > 0) result += digits[fen] + '分'
  }

  return result
}

function intPartToString(num: number): string {
  if (num === 0) return '零'

  const str = num.toString()
  const groups: string[] = []

  let remaining = str
  while (remaining.length > 0) {
    groups.unshift(remaining.slice(-4))
    remaining = remaining.slice(0, -4)
  }

  let result = ''
  let zeroFlag = false

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    const bigUnit = bigUnits[groups.length - 1 - i]

    let groupStr = ''
    let groupZero = false

    for (let j = 0; j < group.length; j++) {
      const digit = parseInt(group[j])
      const unit = units[group.length - 1 - j]

      if (digit === 0) {
        groupZero = true
      } else {
        if (groupZero && (result.length > 0 || groupStr.length > 0)) {
          groupStr += '零'
        }
        groupStr += digits[digit] + unit
        groupZero = false
      }
    }

    if (groupStr) {
      if (zeroFlag && result.length > 0) {
        result += '零'
      }
      result += groupStr + bigUnit
      zeroFlag = false
    } else {
      if (i < groups.length - 1 && !zeroFlag) {
        zeroFlag = true
      }
    }
  }

  return result
}

function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function ChineseNumberConverter() {
  const [inputValue, setInputValue] = useState('12345.67')
  const numValue = parseFloat(inputValue) || 0

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-2">输入金额（元）</div>
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9.]/g, ''))}
          className="w-full text-2xl font-mono bg-transparent outline-none text-foreground"
          placeholder="输入数字..."
        />
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-2">大写金额</div>
        <div className="text-xl text-primary font-medium">
          {numValue === 0 ? '零元整' : toChineseUpper(numValue)}
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">数字格式</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">数字</span>
            <span className="font-mono">{formatNumber(numValue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">中文小写</span>
            <span>{numValue.toLocaleString('zh-CN')}元</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">中文大写</span>
            <span>{numValue === 0 ? '零元整' : toChineseUpper(numValue)}</span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">常见金额示例</div>
        <div className="space-y-2 text-sm">
          {[
            { num: 1, desc: '壹元整' },
            { num: 10, desc: '拾元整' },
            { num: 100, desc: '壹佰元整' },
            { num: 1000, desc: '壹仟元整' },
            { num: 10000, desc: '壹万元整' },
            { num: 12345.67, desc: '壹万贰仟叁佰肆拾伍元陆角柒分' },
          ].map((item) => (
            <div
              key={item.num}
              onClick={() => setInputValue(item.num.toString())}
              className="flex justify-between py-1 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2"
            >
              <span className="text-muted-foreground">{formatNumber(item.num)}元</span>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
