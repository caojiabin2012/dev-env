import logoUrl from '@/assets/app-logo.svg'

export function AppLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="dev-env"
      width={size}
      height={size}
      draggable={false}
      className={`select-none ${className}`}
    />
  )
}
