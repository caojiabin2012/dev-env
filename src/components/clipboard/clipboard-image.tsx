import { useEffect, useState } from 'react'
import { getClipboardImageDataUrl } from '@/lib/clipboard-api'

interface ClipboardImageProps {
  itemId: number
  className?: string
  alt?: string
}

export function ClipboardImage({ itemId, className, alt = 'Clipboard image' }: ClipboardImageProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setError(false)

    getClipboardImageDataUrl(itemId)
      .then((dataUrl) => {
        if (!cancelled) {
          setSrc(dataUrl)
        }
      })
      .catch((e) => {
        console.error('Failed to load clipboard image:', e)
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [itemId])

  if (error) {
    return <span className="text-2xl">🖼️</span>
  }

  if (!src) {
    return <span className="text-2xl opacity-40">🖼️</span>
  }

  return <img src={src} alt={alt} className={className} draggable={false} />
}
