export interface Unit {
  id: string
  name: string
  symbol: string
  toBase: number
  fromBase?: (value: number) => number
}

export interface UnitGroup {
  id: string
  name: string
  icon: string
  units: Unit[]
}

export const unitGroups: UnitGroup[] = [
  {
    id: 'length',
    name: '长度',
    icon: '📏',
    units: [
      { id: 'mm', name: '毫米', symbol: 'mm', toBase: 0.001 },
      { id: 'cm', name: '厘米', symbol: 'cm', toBase: 0.01 },
      { id: 'dm', name: '分米', symbol: 'dm', toBase: 0.1 },
      { id: 'm', name: '米', symbol: 'm', toBase: 1 },
      { id: 'km', name: '千米', symbol: 'km', toBase: 1000 },
      { id: 'li', name: '里', symbol: '里', toBase: 500 },
      { id: 'chi', name: '尺', symbol: '尺', toBase: 1 / 3 },
      { id: 'inch', name: '英寸', symbol: 'in', toBase: 0.0254 },
      { id: 'ft', name: '英尺', symbol: 'ft', toBase: 0.3048 },
      { id: 'yd', name: '码', symbol: 'yd', toBase: 0.9144 },
      { id: 'mi', name: '英里', symbol: 'mi', toBase: 1609.344 },
      { id: 'nmi', name: '海里', symbol: 'nmi', toBase: 1852 },
    ],
  },
  {
    id: 'weight',
    name: '重量',
    icon: '⚖️',
    units: [
      { id: 'mg', name: '毫克', symbol: 'mg', toBase: 0.000001 },
      { id: 'g', name: '克', symbol: 'g', toBase: 0.001 },
      { id: 'kg', name: '千克', symbol: 'kg', toBase: 1 },
      { id: 'ton', name: '吨', symbol: 't', toBase: 1000 },
      { id: 'liang', name: '两', symbol: '两', toBase: 0.05 },
      { id: 'jin', name: '斤', symbol: '斤', toBase: 0.5 },
      { id: 'carat', name: '克拉', symbol: 'ct', toBase: 0.0002 },
      { id: 'oz', name: '盎司', symbol: 'oz', toBase: 0.028349523 },
      { id: 'lb', name: '磅', symbol: 'lb', toBase: 0.4535924 },
    ],
  },
  {
    id: 'area',
    name: '面积',
    icon: '📐',
    units: [
      { id: 'mm2', name: '平方毫米', symbol: 'mm²', toBase: 0.000001 },
      { id: 'cm2', name: '平方厘米', symbol: 'cm²', toBase: 0.0001 },
      { id: 'm2', name: '平方米', symbol: 'm²', toBase: 1 },
      { id: 'km2', name: '平方千米', symbol: 'km²', toBase: 1000000 },
      { id: 'ha', name: '公顷', symbol: 'ha', toBase: 10000 },
      { id: 'mu', name: '亩', symbol: '亩', toBase: 666.6667 },
      { id: 'sqft', name: '平方英尺', symbol: 'ft²', toBase: 0.09290304 },
      { id: 'sqmi', name: '平方英里', symbol: 'mi²', toBase: 2589988.11 },
      { id: 'acre', name: '英亩', symbol: 'acre', toBase: 4046.8564224 },
    ],
  },
  {
    id: 'volume',
    name: '体积',
    icon: '📦',
    units: [
      { id: 'ml', name: '毫升', symbol: 'mL', toBase: 0.001 },
      { id: 'l', name: '升', symbol: 'L', toBase: 1 },
      { id: 'm3', name: '立方米', symbol: 'm³', toBase: 1000 },
      { id: 'gal', name: '加仑', symbol: 'gal', toBase: 3.78541 },
      { id: 'qt', name: '夸脱', symbol: 'qt', toBase: 0.946353 },
      { id: 'pt', name: '品脱', symbol: 'pt', toBase: 0.473176 },
      { id: 'cup', name: '杯', symbol: 'cup', toBase: 0.236588 },
      { id: 'floz', name: '液盎司', symbol: 'fl oz', toBase: 0.0295735 },
    ],
  },
  {
    id: 'temperature',
    name: '温度',
    icon: '🌡️',
    units: [
      { id: 'c', name: '摄氏度', symbol: '°C', toBase: 1, fromBase: (v) => v },
      { id: 'f', name: '华氏度', symbol: '°F', toBase: 1, fromBase: (v) => v },
      { id: 'k', name: '开尔文', symbol: 'K', toBase: 1, fromBase: (v) => v },
    ],
  },
  {
    id: 'speed',
    name: '速度',
    icon: '🚀',
    units: [
      { id: 'mps', name: '米每秒', symbol: 'm/s', toBase: 1 },
      { id: 'kmh', name: '千米每小时', symbol: 'km/h', toBase: 0.277778 },
      { id: 'mph', name: '英里每小时', symbol: 'mph', toBase: 0.44704 },
      { id: 'knot', name: '节', symbol: 'kn', toBase: 0.514444 },
      { id: 'mach', name: '马赫', symbol: 'Mach', toBase: 340.29 },
    ],
  },
  {
    id: 'time',
    name: '时间',
    icon: '⏰',
    units: [
      { id: 'ms', name: '毫秒', symbol: 'ms', toBase: 0.001 },
      { id: 's', name: '秒', symbol: 's', toBase: 1 },
      { id: 'min', name: '分钟', symbol: 'min', toBase: 60 },
      { id: 'h', name: '小时', symbol: 'h', toBase: 3600 },
      { id: 'day', name: '天', symbol: '天', toBase: 86400 },
      { id: 'week', name: '周', symbol: '周', toBase: 604800 },
      { id: 'month', name: '月(30天)', symbol: '月', toBase: 2592000 },
      { id: 'year', name: '年(365天)', symbol: '年', toBase: 31536000 },
    ],
  },
  {
    id: 'data',
    name: '数据',
    icon: '💾',
    units: [
      { id: 'b', name: '字节', symbol: 'B', toBase: 1 },
      { id: 'kb', name: '千字节', symbol: 'KB', toBase: 1024 },
      { id: 'mb', name: '兆字节', symbol: 'MB', toBase: 1048576 },
      { id: 'gb', name: '吉字节', symbol: 'GB', toBase: 1073741824 },
      { id: 'tb', name: '太字节', symbol: 'TB', toBase: 1099511627776 },
      { id: 'pb', name: '拍字节', symbol: 'PB', toBase: 1125899906842624 },
    ],
  },
]

export function getUnitGroup(id: string): UnitGroup | undefined {
  return unitGroups.find((g) => g.id === id)
}

export function convert(value: number, fromUnit: Unit, toUnit: Unit, groupId: string): number {
  if (groupId === 'temperature') {
    return convertTemperature(value, fromUnit.id, toUnit.id)
  }
  const baseValue = value * fromUnit.toBase
  return baseValue / toUnit.toBase
}

function convertTemperature(value: number, fromId: string, toId: string): number {
  let celsius: number

  switch (fromId) {
    case 'c':
      celsius = value
      break
    case 'f':
      celsius = (value - 32) * (5 / 9)
      break
    case 'k':
      celsius = value - 273.15
      break
    default:
      celsius = value
  }

  switch (toId) {
    case 'c':
      return celsius
    case 'f':
      return celsius * (9 / 5) + 32
    case 'k':
      return celsius + 273.15
    default:
      return celsius
  }
}
