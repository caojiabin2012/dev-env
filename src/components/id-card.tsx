import { useState, useMemo, useCallback } from 'react'
import { searchRegions, type FlatRegion } from '@/lib/region-codes'
import { generateIdCards, parseIdCard, type IdCardResult } from '@/lib/id-card'
import { copyToClipboard } from '@/lib/clipboard-api'
import { notify } from '@/lib/toast'

type TabType = 'parse' | 'generate'

export function IdCardTool() {
  const [tab, setTab] = useState<TabType>('parse')

  // 生成模式
  const [regionKeyword, setRegionKeyword] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<FlatRegion | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [startYear, setStartYear] = useState(1980)
  const [endYear, setEndYear] = useState(2005)
  const [gender, setGender] = useState<'male' | 'female' | 'random'>('random')
  const [count, setCount] = useState(10)
  const [generated, setGenerated] = useState<IdCardResult[]>([])

  // 解析模式
  const [parseInput, setParseInput] = useState('')
  const [parseResult, setParseResult] = useState<IdCardResult | null>(null)
  const [parseError, setParseError] = useState('')

  const regionResults = useMemo(() => searchRegions(regionKeyword), [regionKeyword])

  const handleGenerate = useCallback(() => {
    if (!selectedRegion) return
    const results = generateIdCards({
      regionCode: selectedRegion.code,
      startYear,
      endYear,
      gender,
      count,
    })
    setGenerated(results)
  }, [selectedRegion, startYear, endYear, gender, count])

  const handleParse = useCallback(() => {
    setParseError('')
    setParseResult(null)
    if (!parseInput.trim()) {
      setParseError('请输入身份证号码')
      return
    }
    const clean = parseInput.trim().toUpperCase()
    if (!/^\d{17}[\dX]$/.test(clean)) {
      setParseError('身份证号码格式不正确，需要18位')
      return
    }
    const result = parseIdCard(clean)
    if (!result.isValid) {
      setParseError('身份证号码格式不正确')
      return
    }
    setParseResult(result)
  }, [parseInput])

  const handleCopy = useCallback(async (text: string, label = '身份证号') => {
    try {
      await copyToClipboard(text)
      notify(`已复制${label}`)
    } catch {
      notify('复制失败')
    }
  }, [])

  const handleCopyAll = useCallback(async () => {
    const text = generated.map((r) => r.id).join('\n')
    try {
      await copyToClipboard(text)
      notify(`已复制全部 ${generated.length} 条`)
    } catch {
      notify('复制失败')
    }
  }, [generated])

  return (
    <div className="h-full flex flex-col">
      {/* 标签页 */}
      <div className="flex border-b border-border px-4">
        <button
          onClick={() => setTab('parse')}
          className={`py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            tab === 'parse'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          号码解析
        </button>
        <button
          onClick={() => setTab('generate')}
          className={`py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            tab === 'generate'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          批量生成
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'parse' ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* 解析输入 */}
            <div>
              <label className="text-sm font-medium mb-1 block">输入身份证号码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parseInput}
                  onChange={(e) => setParseInput(e.target.value)}
                  placeholder="请输入18位身份证号码"
                  maxLength={18}
                  className="flex-1 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleParse}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  解析
                </button>
              </div>
              {parseError && (
                <div className="text-xs text-destructive mt-1">{parseError}</div>
              )}
            </div>

            {/* 解析结果 */}
            {parseResult && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block w-2 h-2 rounded-full ${parseResult.checkCodeValid ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">
                    {parseResult.checkCodeValid ? '校验码正确' : '校验码错误'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">身份证号：</span>
                    <span className="font-mono">{parseResult.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">归属地区：</span>
                    <span>{parseResult.regionName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">区划代码：</span>
                    <span className="font-mono">{parseResult.regionCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">出生日期：</span>
                    <span>{parseResult.birthDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1年$2月$3日')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">性　　别：</span>
                    <span>{parseResult.gender}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">年　　龄：</span>
                    <span>{parseResult.age}岁</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(parseResult.id)}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  复制身份证号
                </button>
              </div>
            )}

            {/* 使用说明 */}
            <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 p-3 rounded-lg">
              <div className="font-medium text-foreground mb-1">身份证号码规则：</div>
              <div>• 前6位：行政区划代码</div>
              <div>• 7-14位：出生日期 (YYYYMMDD)</div>
              <div>• 15-17位：顺序码 (奇数男，偶数女)</div>
              <div>• 第18位：校验码 (根据前17位计算)</div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* 地区选择 */}
            <div>
              <label className="text-sm font-medium mb-1 block">选择地区</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedRegion ? selectedRegion.path : regionKeyword}
                  onChange={(e) => {
                    setRegionKeyword(e.target.value)
                    setSelectedRegion(null)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="搜索省/市/区..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {showDropdown && !selectedRegion && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {regionResults.map((r) => (
                      <button
                        key={r.code}
                        onMouseDown={() => {
                          setSelectedRegion(r)
                          setRegionKeyword('')
                          setShowDropdown(false)
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center justify-between"
                      >
                        <span>{r.path}</span>
                        <span className="text-xs text-muted-foreground">{r.code}</span>
                      </button>
                    ))}
                    {regionResults.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">无匹配结果</div>
                    )}
                  </div>
                )}
              </div>
              {selectedRegion && (
                <div className="text-xs text-muted-foreground mt-1">
                  区划代码：{selectedRegion.code}
                </div>
              )}
            </div>

            {/* 出生年份范围 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">出生年份起始</label>
                <input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(parseInt(e.target.value) || 1970)}
                  min={1940}
                  max={2020}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">出生年份截止</label>
                <input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(parseInt(e.target.value) || 2005)}
                  min={1940}
                  max={2020}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* 性别和数量 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">性别</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="random">随机</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">生成数量</label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={!selectedRegion}
              className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              生成
            </button>

            {/* 生成结果 */}
            {generated.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">生成结果 ({generated.length}条)</span>
                  <button
                    onClick={handleCopyAll}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    全部复制
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">身份证号</th>
                        <th className="px-3 py-2 text-left font-medium">地区</th>
                        <th className="px-3 py-2 text-left font-medium">出生日期</th>
                        <th className="px-3 py-2 text-left font-medium">性别</th>
                        <th className="px-3 py-2 text-left font-medium">年龄</th>
                        <th className="px-3 py-2 text-left font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generated.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                          <td className="px-3 py-2">{r.regionName}</td>
                          <td className="px-3 py-2">{r.birthDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</td>
                          <td className="px-3 py-2">{r.gender}</td>
                          <td className="px-3 py-2">{r.age}岁</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleCopy(r.id)}
                              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                            >
                              复制
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
