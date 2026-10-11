const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric'
})

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter.format(date)
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  const magnitude = Math.abs(minutes)
  if (magnitude < 1) return 'just now'
  if (magnitude < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return `${days}d ago`

  return formatDateTime(value)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

/** `2026-10-11` -> `Oct 11` */
export function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime()) ? day : dayFormatter.format(date)
}

/**
 * Electron wraps renderer-thrown errors as
 * `Error invoking remote method 'x': Error: real message` - unwrap that.
 */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/^Error invoking remote method '[^']*':\s*/, '')
    .replace(/^Error:\s*/, '')
    .trim()
}
