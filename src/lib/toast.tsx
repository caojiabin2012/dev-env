import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: number
  message: string
}

let toastId = 0
let listeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

export function notify(message: string) {
  const id = ++toastId
  toasts = [...toasts, { id, message }]
  listeners.forEach((l) => l(toasts))
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    listeners.forEach((l) => l(toasts))
  }, 2000)
}

export function useToast() {
  const [, setUpdate] = useState(0)

  useEffect(() => {
    const listener = () => setUpdate((n) => n + 1)
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  return { toasts, notify }
}

export function ToastContainer() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg shadow-lg"
        >
          {toast.message}
        </div>
      ))}
    </div>,
    document.body,
  )
}
