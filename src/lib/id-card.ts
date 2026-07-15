// 身份证号码生成与解析

// 校验码计算
function calcCheckCode(id17: string): string {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkChars = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id17[i]) * weights[i]
  }
  return checkChars[sum % 11]
}

// 随机整数
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成随机日期字符串
function randomDateStr(startYear: number, endYear: number): string {
  const year = randInt(startYear, endYear)
  const month = String(randInt(1, 12)).padStart(2, '0')
  const maxDay = new Date(year, parseInt(month), 0).getDate()
  const day = String(randInt(1, maxDay)).padStart(2, '0')
  return `${year}${month}${day}`
}

export interface IdCardResult {
  id: string
  regionCode: string
  regionName: string
  birthDate: string
  birthYear: number
  birthMonth: number
  birthDay: number
  gender: '男' | '女'
  age: number
  isValid: boolean
  checkCodeValid: boolean
}

// 解析身份证号码
export function parseIdCard(id: string): IdCardResult {
  const clean = id.toUpperCase().trim()

  // 验证格式
  if (!/^\d{17}[\dX]$/.test(clean)) {
    return {
      id: clean,
      regionCode: '',
      regionName: '',
      birthDate: '',
      birthYear: 0,
      birthMonth: 0,
      birthDay: 0,
      gender: '男',
      age: 0,
      isValid: false,
      checkCodeValid: false,
    }
  }

  const regionCode = clean.substring(0, 6)
  const birthStr = clean.substring(6, 14)
  const birthYear = parseInt(birthStr.substring(0, 4))
  const birthMonth = parseInt(birthStr.substring(4, 6))
  const birthDay = parseInt(birthStr.substring(6, 8))
  const seqCode = parseInt(clean.substring(14, 17))
  const genderCode = seqCode % 2

  // 校验码验证
  const expectedCheck = calcCheckCode(clean.substring(0, 17))
  const checkCodeValid = clean[17] === expectedCheck

  // 计算年龄
  const now = new Date()
  let age = now.getFullYear() - birthYear
  if (now.getMonth() + 1 < birthMonth || (now.getMonth() + 1 === birthMonth && now.getDate() < birthDay)) {
    age--
  }

  // 查找区域名称
  let regionName = ''
  const allRegions: Record<string, string> = {
    '110101': '东城区', '110102': '西城区', '110105': '朝阳区', '110106': '丰台区',
    '110107': '石景山区', '110108': '海淀区', '110109': '门头沟区', '110111': '房山区',
    '110112': '通州区', '110113': '顺义区', '110114': '昌平区', '110115': '大兴区',
    '110116': '怀柔区', '110117': '平谷区', '110118': '密云区', '110119': '延庆区',
    '120101': '和平区', '120102': '河东区', '120103': '河西区', '120104': '南开区',
    '120105': '河北区', '120106': '红桥区', '120110': '东丽区', '120111': '西青区',
    '120112': '津南区', '120113': '北辰区', '120114': '武清区', '120115': '宝坻区',
    '120116': '滨海新区', '120117': '宁河区', '120118': '静海区', '120119': '蓟州区',
    '130102': '长安区', '130104': '桥西区', '130105': '新华区', '130107': '井陉矿区',
    '130108': '裕华区', '130109': '藁城区', '130110': '鹿泉区', '130111': '栾城区',
    '130121': '井陉县', '130123': '正定县', '130125': '行唐县', '130126': '灵寿县',
    '130127': '高邑县', '130128': '深泽县', '130129': '赞皇县', '130130': '无极县',
    '130131': '平山县', '130132': '元氏县', '130133': '赵县', '130181': '辛集市',
    '130183': '晋州市', '130184': '新乐市',
    '130202': '路南区', '130203': '路北区', '130204': '古冶区', '130205': '开平区',
    '130207': '丰南区', '130208': '丰润区', '130209': '曹妃甸区',
    '130223': '滦县', '130224': '滦南县', '130225': '乐亭县',
    '130227': '迁西县', '130229': '玉田县', '130281': '遵化市', '130283': '迁安市',
    '130302': '海港区', '130303': '山海关区', '130304': '北戴河区', '130306': '抚宁区',
    '130321': '青龙满族自治县', '130322': '昌黎县', '130324': '卢龙县',
    '130402': '邯山区', '130403': '丛台区', '130404': '复兴区', '130406': '峰峰矿区',
    '130421': '邯郸县', '130423': '临漳县', '130424': '成安县', '130425': '大名县',
    '130426': '涉县', '130427': '磁县', '130428': '肥乡县', '130429': '永年县',
    '130430': '邱县', '130431': '鸡泽县', '130432': '广平县', '130433': '馆陶县',
    '130434': '魏县', '130435': '曲周县', '130481': '武安市',
    '310101': '黄浦区', '310104': '徐汇区', '310105': '长宁区', '310106': '静安区',
    '310107': '普陀区', '310109': '虹口区', '310110': '杨浦区', '310112': '闵行区',
    '310113': '宝山区', '310114': '嘉定区', '310115': '浦东新区', '310116': '金山区',
    '310117': '松江区', '310118': '青浦区', '310120': '奉贤区', '310151': '崇明区',
    '320102': '玄武区', '320104': '秦淮区', '320105': '建邺区', '320106': '鼓楼区',
    '320111': '浦口区', '320113': '栖霞区', '320114': '雨花台区', '320115': '江宁区',
    '320116': '六合区', '320117': '溧水区', '320118': '高淳区',
    '330102': '上城区', '330103': '下城区', '330104': '江干区', '330105': '拱墅区',
    '330106': '西湖区', '330108': '滨江区', '330109': '萧山区', '330110': '余杭区',
    '330111': '富阳区', '330112': '临安区', '330113': '临平区',
    '440103': '荔湾区', '440104': '越秀区', '440105': '海珠区', '440106': '天河区',
    '440111': '白云区', '440112': '黄埔区', '440113': '番禺区', '440114': '花都区',
    '440115': '南沙区', '440116': '从化区', '440117': '增城区',
    '440303': '罗湖区', '440304': '福田区', '440305': '南山区', '440306': '宝安区',
    '440307': '龙岗区', '440308': '盐田区', '440309': '龙华区', '440310': '坪山区',
    '440311': '光明区',
    '500101': '万州区', '500102': '涪陵区', '500103': '渝中区', '500104': '大渡口区',
    '500105': '江北区', '500106': '沙坪坝区', '500107': '九龙坡区', '500108': '南岸区',
    '500109': '北碚区', '500110': '綦江区', '500111': '大足区', '500112': '渝北区',
    '500113': '巴南区',
    '510104': '锦江区', '510105': '青羊区', '510106': '金牛区', '510107': '武侯区',
    '510108': '成华区', '510112': '龙泉驿区', '510113': '青白江区', '510114': '新都区',
    '510115': '温江区', '510116': '双流区', '510117': '郫都区', '510118': '新津区',
    '370102': '历下区', '370103': '市中区', '370104': '槐荫区', '370105': '天桥区',
    '370112': '历城区', '370113': '长清区',
    '370202': '市南区', '370203': '市北区', '370211': '黄岛区', '370212': '崂山区',
    '370213': '李沧区', '370214': '城阳区',
    '410102': '中原区', '410103': '二七区', '410104': '管城回族区', '410105': '金水区',
    '410106': '上街区', '410108': '惠济区',
    '610102': '新城区', '610103': '碑林区', '610104': '莲湖区', '610111': '灞桥区',
    '610112': '未央区', '610113': '雁塔区',
    '420102': '江岸区', '420103': '江汉区', '420104': '硚口区', '420105': '汉阳区',
    '420106': '武昌区', '420107': '洪山区', '420111': '青山区', '420112': '东西湖区',
    '420113': '汉南区', '420114': '蔡甸区', '420115': '江夏区', '420116': '黄陂区',
    '430102': '芙蓉区', '430103': '天心区', '430104': '岳麓区', '430105': '开福区',
    '430111': '雨花区', '430112': '望城区', '430121': '长沙县',
  }

  regionName = allRegions[regionCode] || `未知(${regionCode})`

  return {
    id: clean,
    regionCode,
    regionName,
    birthDate: birthStr,
    birthYear,
    birthMonth,
    birthDay,
    gender: genderCode === 1 ? '男' : '女',
    age,
    isValid: true,
    checkCodeValid,
  }
}

export interface GenerateOptions {
  regionCode: string
  startYear?: number
  endYear?: number
  gender?: 'male' | 'female' | 'random'
  count?: number
}

// 生成身份证号码
export function generateIdCards(options: GenerateOptions): IdCardResult[] {
  const { regionCode, startYear = 1970, endYear = 2005, gender = 'random', count = 10 } = options
  const results: IdCardResult[] = []

  for (let i = 0; i < count; i++) {
    const birthDate = randomDateStr(startYear, endYear)

    // 顺序码 (3位)
    let seq = randInt(0, 499)
    if (gender === 'male') {
      seq = seq * 2 + 1 // 奇数为男
    } else if (gender === 'female') {
      seq = seq * 2 // 偶数为女
    } else {
      seq = Math.random() > 0.5 ? seq * 2 + 1 : seq * 2
    }

    const seqStr = String(seq).padStart(3, '0')
    const id17 = regionCode + birthDate + seqStr
    const checkCode = calcCheckCode(id17)
    const fullId = id17 + checkCode

    results.push(parseIdCard(fullId))
  }

  return results
}

export function isValidIdCard(id: string): boolean {
  const result = parseIdCard(id)
  return result.isValid && result.checkCodeValid
}
