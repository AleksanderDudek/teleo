import { formatDayKey } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'

/** Fixed reminder hours (owner request 2026-10-05): at least one, at most three a day. */
export const REMINDER_LIMITS = { min: 1, max: 3 } as const
export const DEFAULT_REMINDER_TIMES: readonly string[] = ['07:00', '13:00', '21:00']

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** `HH:MM`, 24-hour clock, zero-padded. */
export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

/** The valid, distinct times in the order given, at most `REMINDER_LIMITS.max`; empty when none is valid. */
export function normalizeReminderTimes(times: readonly unknown[]): string[] {
  const out: string[] = []
  for (const time of times) if (isReminderTime(time) && !out.includes(time)) out.push(time)
  return out.slice(0, REMINDER_LIMITS.max)
}

/** Minutes since midnight. */
export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** The times sorted by the clock. */
export function sortReminderTimes(times: readonly string[]): string[] {
  return [...times].sort((a, b) => minutesOf(a) - minutesOf(b))
}

/** The moment `time` falls on the local calendar day of `date`. */
export function atTime(date: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0)
}

/** The local calendar day of a moment (reminders follow the clock, not the app's day start). */
export function clockDayOf(date: Date): DayKey {
  return formatDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** The first reminder strictly after `now`: later today, else tomorrow's earliest; null without times. */
export function nextReminderAt(times: readonly string[], now: Date): Date | null {
  const sorted = sortReminderTimes(normalizeReminderTimes(times))
  const [earliest] = sorted
  if (earliest === undefined) return null
  for (const time of sorted) {
    const at = atTime(now, time)
    if (at.getTime() > now.getTime()) return at
  }
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return atTime(tomorrow, earliest)
}

/** The latest reminder already due today (at or before `now`), or null when none has come yet. */
export function passedReminderToday(times: readonly string[], now: Date): string | null {
  const passed = sortReminderTimes(normalizeReminderTimes(times)).filter((time) => atTime(now, time).getTime() <= now.getTime())
  return passed.at(-1) ?? null
}
