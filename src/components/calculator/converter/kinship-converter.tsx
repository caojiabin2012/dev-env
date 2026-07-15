import { useState } from 'react'

type Gender = 'male' | 'female'

const kinshipMap: Record<string, Record<string, string>> = {
  father: {
    father: '爷爷',
    mother: '奶奶',
    brother: '伯父/叔父',
    sister: '姑姑',
    son: '兄弟',
    daughter: '姐妹',
    wife: '伯母/婶婶',
    husband: '姑父',
  },
  mother: {
    father: '外公',
    mother: '外婆',
    brother: '舅舅',
    sister: '姨妈',
    son: '表兄弟',
    daughter: '表姐妹',
    wife: '舅妈',
    husband: '姨父',
  },
  brother: {
    son: '侄子',
    daughter: '侄女',
    wife: '嫂子/弟妹',
    husband: '姐夫/妹夫',
  },
  sister: {
    son: '外甥',
    daughter: '外甥女',
    wife: '姐夫/妹夫',
    husband: '姐夫/妹夫',
  },
  husband: {
    father: '公公',
    mother: '婆婆',
    brother: '大伯/小叔',
    sister: '大姑/小姑',
  },
  wife: {
    father: '岳父',
    mother: '岳母',
    brother: '大舅/小舅',
    sister: '大姨/小姨',
  },
  son: {
    wife: '儿媳',
    son: '孙子',
    daughter: '孙女',
  },
  daughter: {
    husband: '女婿',
    son: '外孙',
    daughter: '外孙女',
  },
}

const relationships = [
  { id: 'father', name: '父亲', gender: 'male' as Gender },
  { id: 'mother', name: '母亲', gender: 'female' as Gender },
  { id: 'husband', name: '丈夫', gender: 'male' as Gender },
  { id: 'wife', name: '妻子', gender: 'female' as Gender },
  { id: 'brother', name: '兄弟', gender: 'male' as Gender },
  { id: 'sister', name: '姐妹', gender: 'female' as Gender },
  { id: 'son', name: '儿子', gender: 'male' as Gender },
  { id: 'daughter', name: '女儿', gender: 'female' as Gender },
]

export function KinshipConverter() {
  const [fromPerson, setFromPerson] = useState('father')
  const [toPerson, setToPerson] = useState('brother')

  const from = relationships.find((r) => r.id === fromPerson)!
  const to = relationships.find((r) => r.id === toPerson)!

  const kinshipResult = kinshipMap[fromPerson]?.[toPerson] || '未知'

  const relatedKinships = Object.entries(kinshipMap[fromPerson] || {}).map(
    ([key, value]) => {
      const rel = relationships.find((r) => r.id === key)
      return {
        id: key,
        name: rel?.name || key,
        kinship: value,
      }
    }
  )

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm text-muted-foreground mb-3">选择关系</div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">我的</label>
            <div className="flex flex-wrap gap-2">
              {relationships.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setFromPerson(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    fromPerson === r.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {r.gender === 'male' ? '👨' : '👩'} {r.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-muted-foreground">的</div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">应该叫</label>
            <div className="flex flex-wrap gap-2">
              {relationships.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setToPerson(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    toPerson === r.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {r.gender === 'male' ? '👨' : '👩'} {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-center py-4">
          <div className="text-sm text-muted-foreground mb-2">
            {from.gender === 'male' ? '👨' : '👩'} 我的{from.name}
          </div>
          <div className="text-3xl font-bold text-primary mb-2">
            {kinshipResult}
          </div>
          <div className="text-sm text-muted-foreground">
            {to.gender === 'male' ? '👨' : '👩'} {to.name}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">相关称呼</div>
        <div className="space-y-2">
          {relatedKinships.map((item) => (
            <div
              key={item.id}
              onClick={() => setToPerson(item.id)}
              className="flex justify-between py-2 px-2 -mx-2 rounded cursor-pointer hover:bg-accent/50"
            >
              <span className="text-muted-foreground">{item.name}</span>
              <span className="text-foreground">{item.kinship}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-sm font-medium text-muted-foreground mb-3">常见称呼图谱</div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 父亲的父亲 = 爷爷</p>
          <p>• 父亲的母亲 = 奶奶</p>
          <p>• 母亲的父亲 = 外公</p>
          <p>• 母亲的母亲 = 外婆</p>
          <p>• 父亲的兄弟 = 伯父/叔父</p>
          <p>• 父亲的姐妹 = 姑姑</p>
          <p>• 母亲的兄弟 = 舅舅</p>
          <p>• 母亲的姐妹 = 姨妈</p>
        </div>
      </div>
    </div>
  )
}
