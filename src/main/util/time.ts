/** Small ISO-8601 / date helpers. All timestamps are stored as ISO UTC strings
 *  so that lexicographic comparison equals chronological comparison in SQL. */

export function nowIso(): string {
  return new Date().toISOString()
}

export function toIso(value: Date): string {
  return value.toISOString()
}

export function startOfLocalDay(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Monday as the first day of the week. */
export function startOfLocalWeek(from: Date = new Date()): Date {
  const d = startOfLocalDay(from)
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function addDays(value: Date, days: number): Date {
  const d = new Date(value)
  d.setDate(d.getDate() + days)
  return d
}

export function isValidIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
