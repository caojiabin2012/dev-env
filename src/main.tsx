import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { invoke, isTauriEnv } from '@/lib/tauri'

function installClientErrorLogger() {
  if (!isTauriEnv()) return

  const report = (kind: string, message: string) => {
    invoke('record_client_error', { kind, message }).catch(() => {})
  }

  window.addEventListener('error', (event) => {
    const location = event.filename
      ? `${event.filename}:${event.lineno}:${event.colno}`
      : 'unknown'
    report('error', `${event.message} @ ${location}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    report('unhandledrejection', String(event.reason))
  })
}

installClientErrorLogger()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
