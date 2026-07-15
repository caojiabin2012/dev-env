export function formatNumber(num: number, decimals: number = 2): string {
  if (!isFinite(num)) {
    if (isNaN(num)) return 'Error'
    return num > 0 ? 'Infinity' : '-Infinity'
  }

  if (Math.abs(num) < 1e-10 && num !== 0) {
    return num.toExponential(6)
  }

  if (Math.abs(num) >= 1e15) {
    return num.toExponential(6)
  }

  const parts = num.toFixed(decimals).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return parts.join('.')
}

export function parseInputNumber(value: string): number {
  const cleaned = value.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/** 转换结果格式化：去尾零 + 千分位，不可在加逗号后再 parseFloat */
export function formatResult(num: number, maxDecimals: number = 6): string {
  if (!isFinite(num)) {
    if (isNaN(num)) return 'Error'
    return num > 0 ? 'Infinity' : '-Infinity'
  }
  if (Math.abs(num) < 1e-10 && num !== 0) {
    return num.toExponential(6)
  }
  if (Math.abs(num) >= 1e15) {
    return num.toExponential(6)
  }

  const trimmed = num.toFixed(maxDecimals).replace(/\.?0+$/, '')
  const [intPart, decPart] = trimmed.split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt
}
