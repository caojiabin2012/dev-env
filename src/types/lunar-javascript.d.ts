declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
    getFestivals(): string[]
  }

  export class Lunar {
    getYear(): number
    getMonth(): number
    getDay(): number
    getYearInGanZhi(): string
    getMonthInGanZhi(): string
    getDayInGanZhi(): string
    getYearShengXiao(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getYearNaYin(): string
    getDayYi(): string[]
    getDayJi(): string[]
    getZhiXing(): string
    getDayJiShen(): string | string[]
    getDayXiongSha(): string | string[]
    getChongDesc(): string
    getChong(): string
    getPengZuGan(): string
    getPengZuZhi(): string
    getXiu(): string
    getFestivals(): string[]
    getJieQi(): string | null
  }

  export class HolidayUtil {
    static getDayOff(date: string): number
  }
}
