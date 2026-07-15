// 农历算法 - 基于 lunar-javascript 库
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Solar } from 'lunar-javascript'

export interface LunarDate {
  year: number
  month: number
  day: number
  isLeapMonth: boolean
  yearGanZhi: string
  monthGanZhi: string
  dayGanZhi: string
  shengXiao: string
  monthName: string
  dayName: string
  naYin: string
}

export interface HuangLiInfo {
  yi: string[]
  ji: string[]
  zhiShen: string
  jiShen: string[]
  xiongSha: string[]
  chongSha: string
  chongFang: string
  wuXing: string
  pengZu: string
  xingSuo: string
}

export function solarToLunar(date: Date): LunarDate {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()

  const lunarYear = lunar.getYear()
  const lunarMonth = lunar.getMonth()
  const lunarDay = lunar.getDay()
  const isLeapMonth = lunar.getMonth() < 0

  const yearGanZhi = lunar.getYearInGanZhi()
  const monthGanZhi = lunar.getMonthInGanZhi()
  const dayGanZhi = lunar.getDayInGanZhi()
  const shengXiao = lunar.getYearShengXiao()
  const monthName = (isLeapMonth ? '闰' : '') + lunar.getMonthInChinese() + '月'
  const dayName = lunar.getDayInChinese()
  const naYin = lunar.getYearNaYin()

  return {
    year: lunarYear,
    month: Math.abs(lunarMonth),
    day: lunarDay,
    isLeapMonth,
    yearGanZhi,
    monthGanZhi,
    dayGanZhi,
    shengXiao,
    monthName,
    dayName,
    naYin,
  }
}

export function getHuangLiInfo(date: Date): HuangLiInfo {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunar = solar.getLunar()

  const yi = lunar.getDayYi()
  const ji = lunar.getDayJi()
  const zhiShen = lunar.getZhiXing()
  const rawJiShen = lunar.getDayJiShen()
  const rawXiongSha = lunar.getDayXiongSha()
  const jiShen = Array.isArray(rawJiShen) ? rawJiShen : [rawJiShen]
  const xiongSha = Array.isArray(rawXiongSha) ? rawXiongSha : [rawXiongSha]
  const chongSha = lunar.getChongDesc()
  const chongFang = '冲' + lunar.getChong()
  const wuXingMap: Record<string, string> = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' }
  const dayGan = lunar.getDayInGanZhi()[0]
  const wuXing = wuXingMap[dayGan] || '无'
  const pengZu = '彭祖百忌：' + lunar.getPengZuGan() + ' ' + lunar.getPengZuZhi()
  const xingSuo = lunar.getXiu()

  return { yi, ji, zhiShen, jiShen, xiongSha, chongSha, chongFang, wuXing, pengZu, xingSuo }
}

export function getWesternZodiac(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const zodiacDates = [
    [1, 20], [2, 19], [3, 21], [4, 20], [5, 21], [6, 22],
    [7, 23], [8, 23], [9, 23], [10, 23], [11, 23], [12, 22],
  ]
  const zodiacNames = ['摩羯座', '水瓶座', '双鱼座', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座']
  let index = month - 1
  if (day < zodiacDates[index][1]) {
    index = (index - 1 + 12) % 12
  }
  return zodiacNames[index]
}

export function getSolarTerm(date: Date): string | null {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const jieQi = solar.getLunar().getJieQi()
  return jieQi || null
}

// 获取节日（农历+公历）
export function getFestivals(date: Date): string[] {
  const festivals: string[] = []
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunar = solar.getLunar()

  // 农历节日
  const lunarFestivals = lunar.getFestivals()
  if (lunarFestivals && lunarFestivals.length > 0) {
    festivals.push(...lunarFestivals)
  }

  // 公历节日
  const solarFestivals = solar.getFestivals()
  if (solarFestivals && solarFestivals.length > 0) {
    festivals.push(...solarFestivals)
  }

  // 法定节假日
  const jieQi = lunar.getJieQi()
  if (jieQi) {
    festivals.push(jieQi)
  }

  return festivals
}

export function getDateAnalysis(date: Date): {
  summary: string
  advice: string
  mood: string
  color: string
  direction: string
} {
  const lunarData = solarToLunar(date)
  const huangLi = getHuangLiInfo(date)
  const term = getSolarTerm(date)

  const wuXingAdvice: Record<string, { mood: string; color: string; direction: string }> = {
    '木': { mood: '平和', color: '绿色', direction: '东方' },
    '火': { mood: '热情', color: '红色', direction: '南方' },
    '土': { mood: '稳重', color: '黄色', direction: '中央' },
    '金': { mood: '果断', color: '白色', direction: '西方' },
    '水': { mood: '灵活', color: '黑色', direction: '北方' },
  }
  const wuXingData = wuXingAdvice[huangLi.wuXing] || { mood: '平常', color: '日常', direction: '无特殊' }

  let summary = `${lunarData.yearGanZhi}年 ${lunarData.monthName}${lunarData.dayName}`
  if (term) summary += ` [${term}]`

  const yiStr = huangLi.yi.slice(0, 3).join('、')
  const jiStr = huangLi.ji.slice(0, 3).join('、')
  let advice = `今日宜：${yiStr}。忌：${jiStr}。`
  if (huangLi.jiShen.length > 0) {
    advice += ` 吉神：${huangLi.jiShen.join('、')}。`
  }

  return { summary, advice, mood: wuXingData.mood, color: wuXingData.color, direction: wuXingData.direction }
}

export function getMonthCalendar(year: number, month: number): {
  date: Date
  lunar: LunarDate
  isToday: boolean
  isCurrentMonth: boolean
  term: string | null
  festivals: string[]
}[] {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const today = new Date()

  const calendar: {
    date: Date
    lunar: LunarDate
    isToday: boolean
    isCurrentMonth: boolean
    term: string | null
    festivals: string[]
  }[] = []

  for (let i = startWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, -i)
    calendar.push({ date, lunar: solarToLunar(date), isToday: false, isCurrentMonth: false, term: getSolarTerm(date), festivals: getFestivals(date) })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month - 1, d)
    calendar.push({ date, lunar: solarToLunar(date), isToday: date.toDateString() === today.toDateString(), isCurrentMonth: true, term: getSolarTerm(date), festivals: getFestivals(date) })
  }

  const remaining = 42 - calendar.length
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month, i)
    calendar.push({ date, lunar: solarToLunar(date), isToday: false, isCurrentMonth: false, term: getSolarTerm(date), festivals: getFestivals(date) })
  }

  return calendar
}
