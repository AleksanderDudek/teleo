import type { DayKey } from '@/domain/types'

/** Leaderboard periods: a day, a week (Monday–Sunday) and a calendar month. */
export type Period = 'day' | 'week' | 'month'
export const PERIODS = ['day', 'week', 'month'] as const satisfies readonly Period[]

/** The Monday that starts the week of `dayKey` (same format). */
export function weekKey(dayKey: DayKey): DayKey {
  const date = new Date(`${dayKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

/** `YYYY-MM` of `dayKey`. */
export function monthKey(dayKey: DayKey): string {
  return dayKey.slice(0, 7)
}

export function periodKey(period: Period, dayKey: DayKey): string {
  return period === 'day' ? dayKey : period === 'week' ? weekKey(dayKey) : monthKey(dayKey)
}

/** Points (XP) per period key. */
export function pointsByPeriod(daily: ReadonlyArray<{ dayKey: DayKey; xp: number }>, period: Period): Map<string, number> {
  const totals = new Map<string, number>()
  for (const day of daily) {
    const key = periodKey(period, day.dayKey)
    totals.set(key, (totals.get(key) ?? 0) + day.xp)
  }
  return totals
}

export interface PersonalBoard {
  currentKey: string
  /** Points of the current period so far. */
  current: number
  /** Best period ever (possibly the current one). */
  best: number
  /** Place of the current period among all your periods with points (1 = best; ties share a place). */
  rank: number
  /** How many periods take part: those with points, plus the current one. */
  periods: number
  /** Best periods, most points first (ties: older first). */
  top: Array<{ key: string; points: number }>
}

/** You against yourself: how the current day/week/month compares with every earlier one. */
export function personalBoard(daily: ReadonlyArray<{ dayKey: DayKey; xp: number }>, period: Period, today: DayKey, limit = 5): PersonalBoard {
  const currentKey = periodKey(period, today)
  const totals = pointsByPeriod(daily, period)
  const current = totals.get(currentKey) ?? 0
  const scored = [...totals].filter(([key, points]) => points > 0 || key === currentKey)
  if (!totals.has(currentKey)) scored.push([currentKey, 0])
  const ranked = scored
    .filter(([, points]) => points > 0)
    .map(([key, points]) => ({ key, points }))
    .sort((a, b) => b.points - a.points || (a.key < b.key ? -1 : 1))
  return {
    currentKey,
    current,
    best: ranked[0]?.points ?? 0,
    rank: 1 + scored.filter(([, points]) => points > current).length,
    periods: scored.length,
    top: ranked.slice(0, limit),
  }
}
