import type { DayKey, Lang } from '@/domain/types'
import type { DayMarks } from './streaks'
import { computeStreak, weeklyRhythmBest } from './streaks'

/** Values measured by global achievement rules (spec §9.6). */
export const GLOBAL_METRICS = [
  'bestStreak',
  'weeklyRhythmBest',
  'goalDays',
  'dailyMax',
  'totalSegments',
  'sessionsCompleted',
  'perfectSessions',
  'fullSessions',
  'morningDays',
  'eveningDays',
  'ownTexts',
  'bilingualDays',
  'comebacks',
  'level',
] as const
export type GlobalMetric = (typeof GLOBAL_METRICS)[number]

/** Values measured by per-text achievement rules (spec §9.5). */
export const TEXT_METRICS = [
  'textRepetitions',
  'textBestDayStreak',
  'textFlawless',
  'textMemoryRuns',
] as const
export type TextMetric = (typeof TEXT_METRICS)[number]

const globalMetrics: ReadonlySet<string> = new Set(GLOBAL_METRICS)
const textMetrics: ReadonlySet<string> = new Set(TEXT_METRICS)

export function isGlobalMetric(value: unknown): value is GlobalMetric {
  return typeof value === 'string' && globalMetrics.has(value)
}

export function isTextMetric(value: unknown): value is TextMetric {
  return typeof value === 'string' && textMetrics.has(value)
}

/** One-sentence texts need this many first-try accepts in a row for `text.perfect`. */
export const FLAWLESS_FIRST_TRY_RUN = 10

/** The fields of a `DailyStats` row that achievements read. */
export interface DailyStatsLike {
  dayKey: DayKey
  segmentsAccepted: number
  sessionsCompleted: number
  goalReached: boolean
  frozen: boolean
  langs: readonly Lang[]
  morning: boolean
  evening: boolean
}

/** Counters of the `game` settings row that cannot be derived from daily stats. */
export interface GameCountersLike {
  perfectSessions: number
  fullSessions: number
  comebacks: number
}

/** The fields of a `TextStats` row that achievements read. */
export interface TextStatsLike {
  repetitions: number
  bestDayStreak: number
  perfectRuns: number
  bestConsecutiveFirstTry: number
  memoryRuns: number
}

/** Streak view of the daily history: active = at least one accepted segment. */
export function dayMarksFrom(daily: readonly DailyStatsLike[]): DayMarks {
  return new Map(
    daily.map((day) => [day.dayKey, { active: day.segmentsAccepted > 0, frozen: day.frozen }]),
  )
}

export function buildGlobalMetrics(input: {
  daily: readonly DailyStatsLike[]
  game: GameCountersLike
  ownTexts: number
  level: number
  today: DayKey
}): Record<GlobalMetric, number> {
  const { daily, game, ownTexts, level, today } = input
  const marks = dayMarksFrom(daily)
  const count = (test: (day: DailyStatsLike) => boolean) => daily.filter(test).length
  const sum = (value: (day: DailyStatsLike) => number) =>
    daily.reduce((total, day) => total + value(day), 0)
  return {
    bestStreak: computeStreak(marks, today).best,
    weeklyRhythmBest: weeklyRhythmBest(marks),
    goalDays: count((day) => day.goalReached),
    dailyMax: daily.reduce((max, day) => Math.max(max, day.segmentsAccepted), 0),
    totalSegments: sum((day) => day.segmentsAccepted),
    sessionsCompleted: sum((day) => day.sessionsCompleted),
    perfectSessions: game.perfectSessions,
    fullSessions: game.fullSessions,
    morningDays: count((day) => day.morning),
    eveningDays: count((day) => day.evening),
    ownTexts,
    bilingualDays: count((day) => day.langs.includes('pl') && day.langs.includes('en')),
    comebacks: game.comebacks,
    level,
  }
}

/** `segmentCount` = active segments of the text; it decides how `text.perfect` is earned. */
export function buildTextMetrics(
  stats: TextStatsLike,
  segmentCount: number,
): Record<TextMetric, number> {
  const flawless =
    segmentCount <= 1
      ? stats.bestConsecutiveFirstTry >= FLAWLESS_FIRST_TRY_RUN
      : stats.perfectRuns >= 1
  return {
    textRepetitions: stats.repetitions,
    textBestDayStreak: stats.bestDayStreak,
    textFlawless: flawless ? 1 : 0,
    textMemoryRuns: stats.memoryRuns,
  }
}
