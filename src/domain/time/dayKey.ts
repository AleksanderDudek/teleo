import type { DayKey } from '../types'

const DAY_MS = 86_400_000
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatDayKey(year: number, month: number, day: number): DayKey {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`
}

function parts(day: DayKey): [number, number, number] {
  const match = DAY_KEY.exec(day)
  if (!match) throw new RangeError(`Invalid day key: ${day}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Day keys are calendar labels, so arithmetic happens in UTC where every day has 24 h. */
function toUtcMs(day: DayKey): number {
  const [y, m, d] = parts(day)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): DayKey {
  const date = new Date(ms)
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/**
 * The local day a moment belongs to when the day starts at `dayStartHour`
 * (0–23): with a 03:00 start, 00:30 still counts as the previous day.
 * Uses wall-clock hours, so DST transitions cannot shift the result.
 */
export function dayKeyFor(timestamp: number, dayStartHour: number): DayKey {
  const date = new Date(timestamp)
  if (date.getHours() < dayStartHour) date.setDate(date.getDate() - 1)
  return formatDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function addDays(day: DayKey, n: number): DayKey {
  return fromUtcMs(toUtcMs(day) + n * DAY_MS)
}

/** Whole days from `b` to `a` (`a − b`). */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS)
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: DayKey): number {
  const weekday = new Date(toUtcMs(day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

/** ISO-8601 week label such as `2026-W39` (weeks start on Monday). */
export function isoWeekKey(day: DayKey): string {
  const thursday = toUtcMs(day) + (4 - isoWeekday(day)) * DAY_MS
  const isoYear = new Date(thursday).getUTCFullYear()
  const week = Math.floor((thursday - Date.UTC(isoYear, 0, 1)) / DAY_MS / 7) + 1
  return `${isoYear}-W${pad2(week)}`
}

/** Every day from `from` to `to`, inclusive; empty when `to` precedes `from`. */
export function rangeDays(from: DayKey, to: DayKey): DayKey[] {
  const count = diffDays(to, from) + 1
  return count > 0 ? Array.from({ length: count }, (_, i) => addDays(from, i)) : []
}

/** Local midnight of the calendar day (for display and date pickers). */
export function dayKeyToLocalDate(day: DayKey): Date {
  const [y, m, d] = parts(day)
  return new Date(y, m - 1, d)
}
