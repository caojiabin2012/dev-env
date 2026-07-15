import { StackPanel } from '@/components/stack'
import { ToastContainer } from '@/lib/toast'
import { isTauriEnv } from '@/lib/tauri'

export type ToolId = string

function BrowserFallback() {
  return (
    <div className="sb-app flex h-screen items-center justify-center bg-[var(--sb-main-bg,#eceef2)] p-6">
      <div className="sb-row-card max-w-md w-full p-6 space-y-3 text-center">
        <div className="text-lg font-semibold text-[var(--sb-text,#111827)]">请使用桌面应用启动</div>
        <p className="text-sm text-[var(--sb-muted,#9aa0ad)] leading-relaxed">
          当前是在浏览器中打开，Tauri 后端 API 不可用。
          <br />
          请在项目目录运行：
        </p>
        <code className="block rounded-lg bg-[var(--sb-hover,#f2f3f6)] px-4 py-3 text-sm font-mono text-[var(--sb-text-secondary,#525866)]">
          npm run tauri dev
        </code>
        <p className="text-xs text-[var(--sb-muted,#9aa0ad)]">不要直接访问 localhost:5180</p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isTauriEnv()) {
    return <BrowserFallback />
  }

  return (
    <div className="sb-app flex h-screen overflow-hidden">
      <main className="flex-1 overflow-hidden">
        <StackPanel />
      </main>
      <ToastContainer />
    </div>
  )
}
