import { addDays, diffDays, isoWeekday } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'

/** The daily fields the progress views need (DailyStats rows fit structurally). */
export interface DailyLike {
  dayKey: DayKey
  segmentsAccepted: number
  firstTryAccepted: number
  goalReached: boolean
  frozen: boolean
}

/** 0 = nothing; 1–3 = thirds of the daily goal; 4 = goal reached. */
export function heatLevel(segments: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (segments <= 0) return 0
  if (segments >= goal) return 4
  const ratio = segments / goal
  return ratio < 1 / 3 ? 1 : ratio < 2 / 3 ? 2 : 3
}

export interface HeatCell {
  dayKey: DayKey
  segments: number
  frozen: boolean
  today: boolean
  future: boolean
}

const mondayOf = (day: DayKey) => addDays(day, 1 - isoWeekday(day))

/** `weeks` Monday-first columns ending with the week that contains `today`. */
export function heatmapWeeks(daily: readonly DailyLike[], today: DayKey, weeks: number): HeatCell[][] {
  const byDay = new Map(daily.map((d) => [d.dayKey, d]))
  const firstMonday = addDays(mondayOf(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dayKey = addDays(firstMonday, w * 7 + d)
      const stats = byDay.get(dayKey)
      return {
        dayKey,
        segments: stats?.segmentsAccepted ?? 0,
        frozen: stats?.frozen ?? false,
        today: dayKey === today,
        future: diffDays(dayKey, today) > 0,
      }
    }),
  )
}

export interface WeeklyRate {
  weekStart: DayKey
  /** First-try accepts / accepts, `null` when nothing was said that week. */
  rate: number | null
  segments: number
}

export function weeklyFirstTry(daily: readonly DailyLike[], today: DayKey, weeks: number): WeeklyRate[] {
  const firstMonday = addDays(mondayOf(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) => {
    const weekStart = addDays(firstMonday, w * 7)
    const days = daily.filter((d) => {
      const offset = diffDays(d.dayKey, weekStart)
      return offset >= 0 && offset < 7
    })
    const segments = days.reduce((sum, d) => sum + d.segmentsAccepted, 0)
    const firstTry = days.reduce((sum, d) => sum + d.firstTryAccepted, 0)
    return { weekStart, segments, rate: segments > 0 ? firstTry / segments : null }
  })
}

export interface SuccessMetrics {
  /** Share of accepted sentences accepted on the first try (target ≥ 80 %, spec §16). */
  firstTryRate: number | null
  /** Share of days since the first activity on which the daily goal was reached. */
  goalDayShare: number | null
  totalSegments: number
  activeDays: number
}

export function successMetrics(daily: readonly DailyLike[], today: DayKey): SuccessMetrics {
  const active = daily.filter((d) => d.segmentsAccepted > 0)
  if (active.length === 0) return { firstTryRate: null, goalDayShare: null, totalSegments: 0, activeDays: 0 }
  const totalSegments = active.reduce((sum, d) => sum + d.segmentsAccepted, 0)
  const firstTry = active.reduce((sum, d) => sum + d.firstTryAccepted, 0)
  const first = active.map((d) => d.dayKey).sort()[0]!
  const span = diffDays(today, first) + 1
  const goalDays = daily.filter((d) => d.goalReached).length
  return { firstTryRate: firstTry / totalSegments, goalDayShare: goalDays / span, totalSegments, activeDays: active.length }
}
