import { describe, expect, expectTypeOf, it } from 'vitest'
import type { DayKey } from '@/domain/types'
import {
  buildGlobalMetrics,
  buildTextMetrics,
  type DailyStatsLike,
  dayMarksFrom,
  GLOBAL_METRICS,
  type GlobalMetric,
  isGlobalMetric,
  isTextMetric,
  TEXT_METRICS,
  type TextMetric,
  type TextStatsLike,
} from './metrics'

function dayRow(dayKey: DayKey, overrides: Partial<DailyStatsLike> = {}): DailyStatsLike {
  return {
    dayKey,
    segmentsAccepted: 0,
    sessionsCompleted: 0,
    goalReached: false,
    frozen: false,
    langs: [],
    morning: false,
    evening: false,
    ...overrides,
  }
}

function textStats(overrides: Partial<TextStatsLike> = {}): TextStatsLike {
  return {
    repetitions: 0,
    bestDayStreak: 0,
    perfectRuns: 0,
    bestConsecutiveFirstTry: 0,
    memoryRuns: 0,
    ...overrides,
  }
}

const NO_COUNTERS = { perfectSessions: 0, fullSessions: 0, comebacks: 0 }

describe('metric names', () => {
  it('lists the global metrics of the rule engine', () => {
    expect(GLOBAL_METRICS).toEqual([
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
    ])
    expectTypeOf<GlobalMetric>().toEqualTypeOf<
      | 'bestStreak'
      | 'weeklyRhythmBest'
      | 'goalDays'
      | 'dailyMax'
      | 'totalSegments'
      | 'sessionsCompleted'
      | 'perfectSessions'
      | 'fullSessions'
      | 'morningDays'
      | 'eveningDays'
      | 'ownTexts'
      | 'bilingualDays'
      | 'comebacks'
      | 'level'
    >()
  })

  it('lists the per-text metrics', () => {
    expect(TEXT_METRICS).toEqual([
      'textRepetitions',
      'textBestDayStreak',
      'textFlawless',
      'textMemoryRuns',
    ])
    expectTypeOf<TextMetric>().toEqualTypeOf<
      'textRepetitions' | 'textBestDayStreak' | 'textFlawless' | 'textMemoryRuns'
    >()
  })

  it('tells global and text metrics apart', () => {
    expect(isGlobalMetric('bestStreak')).toBe(true)
    expect(isGlobalMetric('textRepetitions')).toBe(false)
    expect(isTextMetric('textRepetitions')).toBe(true)
    expect(isTextMetric('level')).toBe(false)
    expect(isGlobalMetric('toString')).toBe(false)
    expect(isTextMetric(7)).toBe(false)
  })
})

describe('dayMarksFrom', () => {
  it('marks days with accepted segments as active and keeps the frozen flag', () => {
    const marks = dayMarksFrom([
      dayRow('2026-09-20', { segmentsAccepted: 3 }),
      dayRow('2026-09-21', { frozen: true }),
      dayRow('2026-09-22'),
    ])
    expect([...marks]).toEqual([
      ['2026-09-20', { active: true, frozen: false }],
      ['2026-09-21', { active: false, frozen: true }],
      ['2026-09-22', { active: false, frozen: false }],
    ])
  })
})

describe('buildGlobalMetrics', () => {
  it('aggregates daily stats and passes counters through', () => {
    const daily = [
      dayRow('2026-09-20', {
        segmentsAccepted: 12,
        sessionsCompleted: 1,
        goalReached: true,
        langs: ['pl'],
        morning: true,
      }),
      dayRow('2026-09-21', {
        segmentsAccepted: 40,
        sessionsCompleted: 2,
        goalReached: true,
        langs: ['en', 'pl'],
        evening: true,
      }),
      dayRow('2026-09-22', { frozen: true }),
      dayRow('2026-09-23', { segmentsAccepted: 3, langs: ['en'], morning: true, evening: true }),
    ]
    const game = { perfectSessions: 2, fullSessions: 1, comebacks: 3 }
    const metrics = buildGlobalMetrics({ daily, game, ownTexts: 4, level: 7, today: '2026-09-23' })
    expect(metrics).toEqual({
      bestStreak: 3, // 20, 21, 22 (frozen), 23
      weeklyRhythmBest: 0,
      goalDays: 2,
      dailyMax: 40,
      totalSegments: 55,
      sessionsCompleted: 3,
      perfectSessions: 2,
      fullSessions: 1,
      morningDays: 2,
      eveningDays: 2,
      ownTexts: 4,
      bilingualDays: 1,
      comebacks: 3,
      level: 7,
    })
  })

  it('derives the streak metrics from active and frozen days', () => {
    const active = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']
    const daily = [
      ...active.map((dayKey) => dayRow(dayKey, { segmentsAccepted: 5 })), // Mon–Fri
      dayRow('2026-09-12', { frozen: true }), // Sat
      dayRow('2026-09-13', { segmentsAccepted: 2 }), // Sun
      dayRow('2026-09-14'), // attempts but nothing accepted: breaks the chain
      dayRow('2026-09-15', { segmentsAccepted: 1 }),
    ]
    const metrics = buildGlobalMetrics({
      daily,
      game: NO_COUNTERS,
      ownTexts: 0,
      level: 1,
      today: '2026-09-15',
    })
    expect(metrics.bestStreak).toBe(6)
    expect(metrics.weeklyRhythmBest).toBe(1)
  })

  it('is all zeros for a new user', () => {
    const metrics = buildGlobalMetrics({
      daily: [],
      game: NO_COUNTERS,
      ownTexts: 0,
      level: 1,
      today: '2026-09-25',
    })
    expect(metrics).toEqual({ ...Object.fromEntries(GLOBAL_METRICS.map((m) => [m, 0])), level: 1 })
  })
})

describe('buildTextMetrics', () => {
  it('passes the per-text counters through', () => {
    const stats = textStats({ repetitions: 88, bestDayStreak: 12, memoryRuns: 2 })
    expect(buildTextMetrics(stats, 4)).toEqual({
      textRepetitions: 88,
      textBestDayStreak: 12,
      textFlawless: 0,
      textMemoryRuns: 2,
    })
  })

  it('makes a multi-segment text flawless after one perfect run', () => {
    expect(buildTextMetrics(textStats({ perfectRuns: 1 }), 3).textFlawless).toBe(1)
    expect(buildTextMetrics(textStats({ perfectRuns: 4 }), 3).textFlawless).toBe(1)
    const noRun = textStats({ perfectRuns: 0, bestConsecutiveFirstTry: 25 })
    expect(buildTextMetrics(noRun, 3).textFlawless).toBe(0)
  })

  it('makes a one-sentence text flawless after 10 consecutive first-try accepts', () => {
    const nine = textStats({ bestConsecutiveFirstTry: 9, perfectRuns: 9 })
    expect(buildTextMetrics(nine, 1).textFlawless).toBe(0)
    expect(buildTextMetrics(textStats({ bestConsecutiveFirstTry: 10 }), 1).textFlawless).toBe(1)
  })
})
