const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()
const dayFormatters = new Map<string, Intl.DateTimeFormat>()
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>()
const numberFormatters = new Map<string, Intl.NumberFormat>()

function dateTimeFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
    dateTimeFormatters.set(locale, formatter)
  }
  return formatter
}

function dayFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = dayFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
    dayFormatters.set(locale, formatter)
  }
  return formatter
}

function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  let formatter = relativeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    relativeFormatters.set(locale, formatter)
  }
  return formatter
}

function numberFormatter(locale: string): Intl.NumberFormat {
  let formatter = numberFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    numberFormatters.set(locale, formatter)
  }
  return formatter
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter(locale).format(date)
}

export function formatRelative(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  // Intl.RelativeTimeFormat renders these natively, e.g. "5 minutes ago" / "5분 전".
  const deltaMs = date.getTime() - Date.now()
  const magnitude = Math.abs(deltaMs)
  const relative = relativeFormatter(locale)

  if (magnitude < 45_000) return relative.format(Math.round(deltaMs / 1000), 'second')
  if (magnitude < 3_600_000) return relative.format(Math.round(deltaMs / 60_000), 'minute')
  if (magnitude < 86_400_000) return relative.format(Math.round(deltaMs / 3_600_000), 'hour')
  if (magnitude < 2_592_000_000) return relative.format(Math.round(deltaMs / 86_400_000), 'day')

  return formatDateTime(value, locale)
}

export function formatBytes(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  const rounded =
    value >= 10 || index === 0 ? String(Math.round(value)) : numberFormatter(locale).format(value)
  return `${rounded} ${units[index]}`
}

/** `2026-10-11` -> `Oct 11` */
export function formatDayLabel(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime()) ? day : dayFormatter(locale).format(date)
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
