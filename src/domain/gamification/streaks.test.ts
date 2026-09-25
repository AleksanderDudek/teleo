import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'
import {
  computeStreak,
  type DayMark,
  FREEZE_EVERY,
  freezeAward,
  isComeback,
  MAX_FREEZES,
  nextTextDayStreak,
  reconcileFreezes,
  weeklyRhythmBest,
} from './streaks'

const START = '2026-09-01'

/** Day marks from `start`, one character per day: A = active, F = frozen, anything else = idle. */
function marks(pattern: string, start: DayKey = START): Map<DayKey, DayMark> {
  const days = new Map<DayKey, DayMark>()
  for (const [i, char] of [...pattern].entries()) {
    if (char === 'A' || char === 'F') {
      days.set(addDays(start, i), { active: char === 'A', frozen: char === 'F' })
    }
  }
  return days
}

/** Day `i` of a pattern. */
const day = (i: number) => addDays(START, i)

/** The last character of the pattern is today. */
const today = (pattern: string) => day(pattern.length - 1)

const streakOf = (pattern: string) => computeStreak(marks(pattern), today(pattern))

describe('computeStreak', () => {
  it('counts consecutive active days ending today', () => {
    expect(streakOf('AAA')).toEqual({ current: 3, best: 3, todayActive: true, atRisk: false })
  })

  it('keeps a chain that ended yesterday, at risk until today is active', () => {
    expect(streakOf('AAA.')).toEqual({ current: 3, best: 3, todayActive: false, atRisk: true })
  })

  it('drops to 0 after two idle days without a freeze', () => {
    expect(streakOf('AAA..')).toEqual({ current: 0, best: 3, todayActive: false, atRisk: false })
    expect(streakOf('AAA..A')).toMatchObject({ current: 1, best: 3 })
  })

  it('lets a frozen day bridge the chain without counting it', () => {
    expect(streakOf('AFA')).toEqual({ current: 2, best: 2, todayActive: true, atRisk: false })
  })

  it('keeps a chain whose last covered day (yesterday) is frozen', () => {
    expect(streakOf('AF.')).toEqual({ current: 1, best: 1, todayActive: false, atRisk: true })
  })

  it('is 0 when the chain holds only frozen days', () => {
    expect(streakOf('FF')).toEqual({ current: 0, best: 0, todayActive: false, atRisk: false })
    expect(streakOf('FF.')).toMatchObject({ current: 0, atRisk: false })
  })

  it('reports the best chain across the whole history', () => {
    expect(streakOf('AAAAA..AA')).toMatchObject({ current: 2, best: 5 })
    expect(streakOf('AA..AFAA')).toMatchObject({ current: 3, best: 3 })
  })

  it('ignores days after today', () => {
    expect(computeStreak(marks('AAAAA'), day(1))).toEqual({
      current: 2,
      best: 2,
      todayActive: true,
      atRisk: false,
    })
  })

  it('is empty without any history', () => {
    expect(computeStreak(new Map(), START)).toEqual({
      current: 0,
      best: 0,
      todayActive: false,
      atRisk: false,
    })
  })

  it('follows the calendar across month and year boundaries', () => {
    expect(computeStreak(marks('AAAA', '2026-12-30'), '2027-01-02').current).toBe(4)
    expect(computeStreak(marks('AAA', '2026-02-27'), '2026-03-01').current).toBe(3)
  })

  it('does not depend on the insertion order of the map', () => {
    const reversed = new Map([...marks('AA.AFA')].reverse())
    expect(computeStreak(reversed, day(5))).toEqual(streakOf('AA.AFA'))
  })
})

describe('reconcileFreezes', () => {
  const reconcile = (pattern: string, freezes: number) =>
    reconcileFreezes(marks(pattern), today(pattern), freezes)
  const nothing = (freezes: number) => ({ frozenDays: [], freezesLeft: freezes })

  it('bridges a single missed day with one freeze', () => {
    expect(reconcile('A..', 1)).toEqual({ frozenDays: [day(1)], freezesLeft: 0 })
  })

  it('bridges two missed days with two freezes, oldest first', () => {
    expect(reconcile('A...', 2)).toEqual({ frozenDays: [day(1), day(2)], freezesLeft: 0 })
  })

  it('keeps unused freezes', () => {
    expect(reconcile('A..', 2)).toEqual({ frozenDays: [day(1)], freezesLeft: 1 })
  })

  it('consumes nothing when the freezes cannot cover the whole gap', () => {
    expect(reconcile('A....', 2)).toEqual(nothing(2))
    expect(reconcile('A..', 0)).toEqual(nothing(0))
  })

  it('does nothing without a gap', () => {
    expect(reconcile('AA', 2)).toEqual(nothing(2))
    expect(reconcile('A.', 2)).toEqual(nothing(2))
  })

  it('does nothing when there was never an active day', () => {
    expect(reconcile('', 2)).toEqual(nothing(2))
    expect(reconcile('....', 2)).toEqual(nothing(2))
  })

  it('does nothing when the chain before the gap holds only frozen days', () => {
    expect(reconcile('FF..', 2)).toEqual(nothing(2))
  })

  it('extends a chain that already ends with a frozen day', () => {
    expect(reconcile('AF..', 1)).toEqual({ frozenDays: [day(2)], freezesLeft: 0 })
  })

  it('bridges the gap even when today is already active', () => {
    expect(reconcile('A.A', 1)).toEqual({ frozenDays: [day(1)], freezesLeft: 0 })
  })

  it('is idempotent once the frozen days are stored', () => {
    const days = marks('AA...')
    const first = reconcileFreezes(days, day(4), 2)
    expect(first.frozenDays).toEqual([day(2), day(3)])
    for (const frozen of first.frozenDays) days.set(frozen, { active: false, frozen: true })
    expect(reconcileFreezes(days, day(4), first.freezesLeft)).toEqual(nothing(0))
    expect(computeStreak(days, day(4))).toMatchObject({ current: 2, atRisk: true })
  })
})

describe('freezeAward', () => {
  it('earns one freeze per 7 streak days, at most 2 in store', () => {
    expect(FREEZE_EVERY).toBe(7)
    expect(MAX_FREEZES).toBe(2)
  })

  it('awards a freeze when the streak reaches 7', () => {
    expect(freezeAward(7, 0, 0)).toEqual({ award: 1, lastAwardStreak: 7 })
  })

  it('does not award twice for the same streak value', () => {
    expect(freezeAward(7, 7, 1)).toEqual({ award: 0, lastAwardStreak: 7 })
  })

  it('awards a second freeze at 14', () => {
    expect(freezeAward(14, 7, 1)).toEqual({ award: 1, lastAwardStreak: 14 })
  })

  it('awards nothing with 2 freezes in store but still marks the milestone', () => {
    expect(freezeAward(21, 14, 2)).toEqual({ award: 0, lastAwardStreak: 21 })
  })

  it('awards again when a new chain reaches 7 after a longer one', () => {
    expect(freezeAward(7, 21, 0)).toEqual({ award: 1, lastAwardStreak: 7 })
  })

  it('ignores streak values that are not a positive multiple of 7', () => {
    expect(freezeAward(8, 7, 1)).toEqual({ award: 0, lastAwardStreak: 7 })
    expect(freezeAward(6, 0, 0)).toEqual({ award: 0, lastAwardStreak: 0 })
    expect(freezeAward(0, 7, 0)).toEqual({ award: 0, lastAwardStreak: 7 })
  })
})

describe('isComeback', () => {
  it('is a comeback after at least 3 full idle days', () => {
    expect(isComeback('2026-09-21', '2026-09-25')).toBe(true)
    expect(isComeback('2026-08-31', '2026-09-25')).toBe(true)
  })

  it('is not a comeback after a shorter break', () => {
    expect(isComeback('2026-09-22', '2026-09-25')).toBe(false)
    expect(isComeback('2026-09-24', '2026-09-25')).toBe(false)
  })

  it('is not a comeback for the very first activity', () => {
    expect(isComeback(undefined, '2026-09-25')).toBe(false)
  })
})

describe('weeklyRhythmBest', () => {
  /** `activeDays[i]` active days, counted from Monday, in the i-th week after `monday`. */
  function weeks(monday: DayKey, ...activeDays: number[]): Map<DayKey, DayMark> {
    const days = new Map<DayKey, DayMark>()
    for (const [week, count] of activeDays.entries()) {
      for (let d = 0; d < count; d++) {
        days.set(addDays(monday, week * 7 + d), { active: true, frozen: false })
      }
    }
    return days
  }
  const MONDAY = '2026-08-31'

  it('counts consecutive ISO weeks with at least 5 active days', () => {
    expect(weeklyRhythmBest(weeks(MONDAY, 5, 5, 5, 5))).toBe(4)
    expect(weeklyRhythmBest(weeks(MONDAY, 7, 7))).toBe(2)
  })

  it('breaks the run on a week with only 4 active days', () => {
    expect(weeklyRhythmBest(weeks(MONDAY, 5, 5, 4, 5, 5, 5))).toBe(3)
    expect(weeklyRhythmBest(weeks(MONDAY, 5, 0, 5))).toBe(1)
  })

  it('is 0 without a qualifying week', () => {
    expect(weeklyRhythmBest(new Map())).toBe(0)
    expect(weeklyRhythmBest(weeks(MONDAY, 4, 4, 4))).toBe(0)
  })

  it('does not count frozen days as active', () => {
    const days = weeks(MONDAY, 4)
    for (let d = 4; d < 7; d++) days.set(addDays(MONDAY, d), { active: false, frozen: true })
    expect(weeklyRhythmBest(days)).toBe(0)
  })

  it('buckets days into Monday–Sunday weeks', () => {
    expect(weeklyRhythmBest(marks('AAAAA', '2026-09-02'))).toBe(1) // Wednesday → Sunday
    expect(weeklyRhythmBest(marks('AAAAA', '2026-09-04'))).toBe(0) // Friday → Tuesday
  })

  it('continues across the 53-week ISO year 2026 into 2027', () => {
    // 2026-W52, 2026-W53, 2027-W01, 2027-W02
    expect(weeklyRhythmBest(weeks('2026-12-21', 5, 5, 5, 5))).toBe(4)
    // 2026-W52 and 2027-W01 are not adjacent: 2026-W53 lies between them
    expect(weeklyRhythmBest(weeks('2026-12-21', 5, 3, 5))).toBe(1)
  })
})

describe('nextTextDayStreak', () => {
  it('starts at 1 the first time a text is said', () => {
    expect(nextTextDayStreak({ current: 0, best: 0 }, '2026-09-25')).toEqual({
      current: 1,
      best: 1,
      lastDayKey: '2026-09-25',
    })
  })

  it('grows by one on the next day and raises the best', () => {
    const prev = { current: 3, best: 5, lastDayKey: '2026-09-24' }
    expect(nextTextDayStreak(prev, '2026-09-25')).toEqual({
      current: 4,
      best: 5,
      lastDayKey: '2026-09-25',
    })
    expect(nextTextDayStreak({ ...prev, current: 5 }, '2026-09-25')).toMatchObject({
      current: 6,
      best: 6,
    })
  })

  it('stays unchanged when said again the same day', () => {
    const prev = { current: 3, best: 5, lastDayKey: '2026-09-25' }
    expect(nextTextDayStreak(prev, '2026-09-25')).toEqual(prev)
  })

  it('restarts at 1 after a missed day, keeping the best', () => {
    const prev = { current: 9, best: 9, lastDayKey: '2026-09-23' }
    expect(nextTextDayStreak(prev, '2026-09-25')).toEqual({
      current: 1,
      best: 9,
      lastDayKey: '2026-09-25',
    })
  })

  it('continues across a year boundary', () => {
    const prev = { current: 2, best: 2, lastDayKey: '2026-12-31' }
    expect(nextTextDayStreak(prev, '2027-01-01')).toMatchObject({ current: 3, best: 3 })
  })
})
