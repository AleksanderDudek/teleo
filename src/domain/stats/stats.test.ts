import { describe, expect, it } from 'vitest'
import { heatmapWeeks, heatLevel, successMetrics, weeklyFirstTry, type DailyLike } from './index'

const day = (dayKey: string, segmentsAccepted: number, extra: Partial<DailyLike> = {}): DailyLike => ({
  dayKey,
  segmentsAccepted,
  firstTryAccepted: segmentsAccepted,
  goalReached: false,
  frozen: false,
  ...extra,
})

describe('heatLevel', () => {
  it('bins sentences relative to the daily goal', () => {
    expect(heatLevel(0, 10)).toBe(0)
    expect(heatLevel(1, 10)).toBe(1)
    expect(heatLevel(3, 10)).toBe(1)
    expect(heatLevel(4, 10)).toBe(2)
    expect(heatLevel(7, 10)).toBe(3)
    expect(heatLevel(9, 10)).toBe(3)
    expect(heatLevel(10, 10)).toBe(4)
    expect(heatLevel(1, 1)).toBe(4)
  })
})

describe('heatmapWeeks', () => {
  it('lays out Monday-first weeks ending with the current week', () => {
    // 2026-09-25 is a Friday.
    const weeks = heatmapWeeks([day('2026-09-21', 5), day('2026-09-24', 0, { frozen: true })], '2026-09-25', 2)
    expect(weeks).toHaveLength(2)
    expect(weeks[1]?.[0]).toMatchObject({ dayKey: '2026-09-21', segments: 5, frozen: false, future: false })
    expect(weeks[1]?.[3]).toMatchObject({ dayKey: '2026-09-24', frozen: true })
    expect(weeks[1]?.[4]).toMatchObject({ dayKey: '2026-09-25', today: true })
    expect(weeks[1]?.[5]).toMatchObject({ dayKey: '2026-09-26', future: true })
    expect(weeks[0]?.[0]?.dayKey).toBe('2026-09-14')
  })
})

describe('weeklyFirstTry', () => {
  it('computes a first-try rate per ISO week, null without activity', () => {
    const weeks = weeklyFirstTry(
      [day('2026-09-21', 10, { firstTryAccepted: 8 }), day('2026-09-23', 10, { firstTryAccepted: 10 }), day('2026-09-10', 4, { firstTryAccepted: 1 })],
      '2026-09-25',
      3,
    )
    expect(weeks.map((w) => [w.weekStart, w.rate])).toEqual([
      ['2026-09-07', 0.25],
      ['2026-09-14', null],
      ['2026-09-21', 0.9],
    ])
  })
})

describe('successMetrics', () => {
  it('reports first-try success, share of goal days and best streak (spec §16)', () => {
    const metrics = successMetrics(
      [day('2026-09-20', 10, { firstTryAccepted: 9, goalReached: true }), day('2026-09-21', 5, { firstTryAccepted: 3 }), day('2026-09-23', 10, { firstTryAccepted: 10, goalReached: true })],
      '2026-09-23',
    )
    expect(metrics.firstTryRate).toBeCloseTo(22 / 25)
    expect(metrics.goalDayShare).toBeCloseTo(2 / 4) // 20th → 23rd = 4 days
    expect(metrics.totalSegments).toBe(25)
    expect(metrics.activeDays).toBe(3)
  })

  it('is empty-safe', () => {
    expect(successMetrics([], '2026-09-23')).toEqual({ firstTryRate: null, goalDayShare: null, totalSegments: 0, activeDays: 0 })
  })
})
