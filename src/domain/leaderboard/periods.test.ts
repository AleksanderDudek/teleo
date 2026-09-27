import { describe, expect, it } from 'vitest'
import { monthKey, periodKey, personalBoard, pointsByPeriod, weekKey } from './periods'

describe('period keys', () => {
  it('starts weeks on Monday', () => {
    expect(weekKey('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(weekKey('2026-09-21')).toBe('2026-09-21') // Monday
    expect(weekKey('2027-01-01')).toBe('2026-12-28') // across the year
  })

  it('keys months by year and month', () => {
    expect(monthKey('2026-09-27')).toBe('2026-09')
    expect(periodKey('day', '2026-09-27')).toBe('2026-09-27')
    expect(periodKey('week', '2026-09-27')).toBe('2026-09-21')
    expect(periodKey('month', '2026-09-27')).toBe('2026-09')
  })
})

const daily = [
  { dayKey: '2026-09-14', xp: 100 },
  { dayKey: '2026-09-15', xp: 300 },
  { dayKey: '2026-09-21', xp: 50 },
  { dayKey: '2026-09-22', xp: 0 },
  { dayKey: '2026-09-27', xp: 200 },
  { dayKey: '2026-08-31', xp: 400 },
]

describe('pointsByPeriod', () => {
  it('sums the points of each day, week and month', () => {
    expect(pointsByPeriod(daily, 'week')).toEqual(new Map([['2026-09-14', 400], ['2026-09-21', 250], ['2026-08-31', 400]]))
    expect(pointsByPeriod(daily, 'month')).toEqual(new Map([['2026-09', 650], ['2026-08', 400]]))
  })
})

describe('personalBoard', () => {
  it('ranks the current period among your own, best first', () => {
    const board = personalBoard(daily, 'week', '2026-09-27')
    expect(board).toMatchObject({ currentKey: '2026-09-21', current: 250, best: 400, rank: 3, periods: 3 })
    expect(board.top).toEqual([
      { key: '2026-08-31', points: 400 },
      { key: '2026-09-14', points: 400 },
      { key: '2026-09-21', points: 250 },
    ])
  })

  it('ties share a rank, and an empty current period still counts', () => {
    expect(personalBoard(daily, 'week', '2026-09-14').rank).toBe(1)
    expect(personalBoard(daily, 'day', '2026-09-30')).toMatchObject({ current: 0, rank: 6, periods: 6, best: 400 })
  })

  it('is empty for a new user', () => {
    expect(personalBoard([], 'month', '2026-09-27')).toEqual({ currentKey: '2026-09', current: 0, best: 0, rank: 1, periods: 1, top: [] })
  })
})
