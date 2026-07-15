import type { SVGProps } from 'react'

// Official SVG logos from simple-icons (CC0) + custom for openresty/memcache
// Import as raw strings to render inline with color control
import nginxRaw from '@/assets/logos/nginx.svg?raw'
import caddyRaw from '@/assets/logos/caddy.svg?raw'
import phpRaw from '@/assets/logos/php.svg?raw'
import composerRaw from '@/assets/logos/composer.svg?raw'
import pythonRaw from '@/assets/logos/python.svg?raw'
import pipRaw from '@/assets/logos/pip.svg?raw'
import goRaw from '@/assets/logos/go.svg?raw'
import nodeRaw from '@/assets/logos/node.svg?raw'
import npmRaw from '@/assets/logos/npm.svg?raw'
import mysqlRaw from '@/assets/logos/mysql.svg?raw'
import mariadbRaw from '@/assets/logos/mariadb.svg?raw'
import redisRaw from '@/assets/logos/redis.svg?raw'
import rabbitmqRaw from '@/assets/logos/rabbitmq.svg?raw'
import kafkaRaw from '@/assets/logos/kafka.svg?raw'
import rocketmqRaw from '@/assets/logos/rocketmq.svg?raw'
import openrestyRaw from '@/assets/logos/openresty.svg?raw'
import memcacheRaw from '@/assets/logos/memcache.svg?raw'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, className, ...props }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, ...props }
}

export function IconPackage(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M12 22V12" />
      <path d="m3 7 9 5 9-5" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconStop(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 20h16" />
    </svg>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export function IconChevron(props: IconProps & { open?: boolean }) {
  const { open, ...rest } = props
  return (
    <svg {...base(rest)} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function IconMore(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconConfig(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconLog(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

export function IconPin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 17v5" />
      <path d="M9 3h6l1 7-4 3-4-3 1-7Z" />
      <path d="M9 10v4" />
    </svg>
  )
}

export function IconInstalled(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}

export function IconDashboard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

export function IconGlobe(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </svg>
  )
}

export function IconRestart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export const PKG_META: Record<string, { label: string; category: string }> = {
  nginx:      { label: 'Nginx',     category: 'Web 服务' },
  openresty:  { label: 'OpenResty', category: 'Web 服务' },
  php:        { label: 'PHP',       category: '语言运行时' },
  composer:   { label: 'Composer',  category: '包管理' },
  python:     { label: 'Python',    category: '语言运行时' },
  pip:        { label: 'pip',       category: '包管理' },
  go:         { label: 'Go',        category: '语言运行时' },
  java:       { label: 'Java',      category: '语言运行时' },
  node:       { label: 'Node.js',   category: '语言运行时' },
  npm:        { label: 'npm',       category: '包管理' },
  mysql:      { label: 'MySQL',     category: '数据库' },
  mariadb:    { label: 'MariaDB',   category: '数据库' },
  redis:      { label: 'Redis',     category: '缓存' },
  memcache:   { label: 'Memcache',  category: '缓存' },
  rabbitmq:   { label: 'RabbitMQ',  category: '消息队列' },
  rocketmq:   { label: 'RocketMQ',  category: '消息队列' },
  kafka:      { label: 'Kafka',     category: '消息队列' },
}

/* ====== Software logos — official SVGs rendered inline ====== */

const RAW_MAP: Record<string, string> = {
  nginx: nginxRaw,
  caddy: caddyRaw,
  openresty: openrestyRaw,
  php: phpRaw,
  composer: composerRaw,
  python: pythonRaw,
  pip: pipRaw,
  go: goRaw,
  node: nodeRaw,
  npm: npmRaw,
  mysql: mysqlRaw,
  mariadb: mariadbRaw,
  redis: redisRaw,
  memcache: memcacheRaw,
  rabbitmq: rabbitmqRaw,
  rocketmq: rocketmqRaw,
  kafka: kafkaRaw,
}

// Fallback SVG as base64 data URI
const FALLBACK_SRC =
  'data:image/svg+xml;base64,' +
  btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#6b7280"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">?</text></svg>')

function svgDataUri(raw: string): string {
  // btoa crashes on non-Latin1, so encode UTF-8 first then convert
  const bytes = new TextEncoder().encode(raw)
  const latin1 = String.fromCharCode(...bytes)
  return 'data:image/svg+xml;base64,' + btoa(latin1)
}

export function SoftwareIcon({ id }: { id: string }) {
  const raw = RAW_MAP[id]
  const src = raw ? svgDataUri(raw) : FALLBACK_SRC
  return <img src={src} className="w-full h-full" alt={id} />
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
