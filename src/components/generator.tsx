import { useState, useCallback } from 'react'
import { notify } from '@/lib/toast'

type TabType = 'uuid' | 'password'

export function GeneratorTool() {
  const [tab, setTab] = useState<TabType>('password')

  return (
    <div className="h-full flex flex-col">
      {/* 标签页 */}
      <div className="flex border-b border-border px-4">
        {(['password', 'uuid'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t === 'password' ? '密码生成' : 'UUID 生成'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'password' && <PasswordTool />}
        {tab === 'uuid' && <UuidTool />}
      </div>
    </div>
  )
}

function UuidTool() {
  const [count, setCount] = useState(10)
  const [version, setVersion] = useState<'v4' | 'v1'>('v4')
  const [uppercase, setUppercase] = useState(false)
  const [noDash, setNoDash] = useState(false)
  const [results, setResults] = useState<string[]>([])

  const generateV4 = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }, [])

  const generateV1 = useCallback(() => {
    const now = Date.now()
    const timeHex = now.toString(16).padStart(12, '0')
    const clockSeq = Math.floor(Math.random() * 0x3fff).toString(16).padStart(4, '0')
    const node = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')
    return `${timeHex.slice(4, 12)}-${timeHex.slice(0, 4)}-1${timeHex.slice(0, 3)}-${clockSeq}-${node}`
  }, [])

  const handleGenerate = useCallback(() => {
    const uuids = Array.from({ length: count }, () => {
      let uuid = version === 'v4' ? generateV4() : generateV1()
      if (uppercase) uuid = uuid.toUpperCase()
      if (noDash) uuid = uuid.replace(/-/g, '')
      return uuid
    })
    setResults(uuids)
  }, [count, version, uppercase, noDash, generateV4, generateV1])

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(results.join('\n'))
    notify('已复制全部 UUID')
  }, [results])

  const handleCopyOne = useCallback((uuid: string) => {
    navigator.clipboard.writeText(uuid)
    notify('已复制 UUID')
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">UUID 版本</label>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value as typeof version)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="v4">v4 (随机)</option>
            <option value="v1">v1 (时间戳)</option>
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

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
            className="rounded"
          />
          大写
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={noDash}
            onChange={(e) => setNoDash(e.target.checked)}
            className="rounded"
          />
          无横线
        </label>
      </div>

      <button
        onClick={handleGenerate}
        className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        生成
      </button>

      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">生成结果 ({results.length}条)</span>
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
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">UUID</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((uuid, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{uuid}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleCopyOne(uuid)}
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

      <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
        <div className="font-medium text-foreground mb-1">说明：</div>
        <div>• UUID v4：完全随机生成，最常用</div>
        <div>• UUID v1：基于时间戳生成，包含时间信息</div>
      </div>
    </div>
  )
}

function PasswordTool() {
  const [length, setLength] = useState(16)
  const [includeUpper, setIncludeUpper] = useState(true)
  const [includeLower, setIncludeLower] = useState(true)
  const [includeNumbers, setIncludeNumbers] = useState(true)
  const [includeSymbols, setIncludeSymbols] = useState(true)
  const [count, setCount] = useState(5)
  const [results, setResults] = useState<string[]>([])

  const generatePassword = useCallback(() => {
    let chars = ''
    if (includeUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (includeLower) chars += 'abcdefghijklmnopqrstuvwxyz'
    if (includeNumbers) chars += '0123456789'
    if (includeSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

    if (!chars) {
      chars = 'abcdefghijklmnopqrstuvwxyz'
    }

    let password = ''
    const array = new Uint32Array(length)
    crypto.getRandomValues(array)
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length]
    }
    return password
  }, [length, includeUpper, includeLower, includeNumbers, includeSymbols])

  const handleGenerate = useCallback(() => {
    const passwords = Array.from({ length: count }, () => generatePassword())
    setResults(passwords)
  }, [count, generatePassword])

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(results.join('\n'))
    notify('已复制全部密码')
  }, [results])

  const handleCopyOne = useCallback((pwd: string) => {
    navigator.clipboard.writeText(pwd)
    notify('已复制密码')
  }, [])

  const getPasswordStrength = (pwd: string): { level: string; color: string } => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (pwd.length >= 16) score++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++

    if (score <= 2) return { level: '弱', color: 'text-red-500' }
    if (score <= 4) return { level: '中', color: 'text-yellow-500' }
    return { level: '强', color: 'text-green-500' }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">密码长度</label>
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(Math.min(64, Math.max(4, parseInt(e.target.value) || 16)))}
            min={4}
            max={64}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">生成数量</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 5)))}
            min={1}
            max={50}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeUpper}
            onChange={(e) => setIncludeUpper(e.target.checked)}
            className="rounded"
          />
          大写字母 (A-Z)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeLower}
            onChange={(e) => setIncludeLower(e.target.checked)}
            className="rounded"
          />
          小写字母 (a-z)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeNumbers}
            onChange={(e) => setIncludeNumbers(e.target.checked)}
            className="rounded"
          />
          数字 (0-9)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeSymbols}
            onChange={(e) => setIncludeSymbols(e.target.checked)}
            className="rounded"
          />
          特殊字符 (!@#$...)
        </label>
      </div>

      <button
        onClick={handleGenerate}
        className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
      >
        生成密码
      </button>

      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">生成结果 ({results.length}条)</span>
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
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">密码</th>
                  <th className="px-3 py-2 text-left font-medium">强度</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((pwd, i) => {
                  const strength = getPasswordStrength(pwd)
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{pwd}</td>
                      <td className={`px-3 py-2 text-xs font-medium ${strength.color}`}>{strength.level}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleCopyOne(pwd)}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          复制
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
        <div className="font-medium text-foreground mb-1">安全建议：</div>
        <div>• 密码长度至少 12 位</div>
        <div>• 包含大小写字母、数字和特殊字符</div>
        <div>• 使用随机密码，不要使用个人信息</div>
        <div>• 不同账号使用不同密码</div>
      </div>
    </div>
  )
}
