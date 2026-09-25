import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayKeyFor,
  dayKeyToLocalDate,
  diffDays,
  formatDayKey,
  isoWeekday,
  isoWeekKey,
  rangeDays,
} from './dayKey'

const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

describe('dayKeyFor', () => {
  it('uses the local calendar day during the day', () => {
    expect(dayKeyFor(local(2026, 3, 10, 10), 3)).toBe('2026-03-10')
  })

  it('counts moments before the day start as the previous day', () => {
    expect(dayKeyFor(local(2026, 3, 10, 0, 30), 3)).toBe('2026-03-09')
    expect(dayKeyFor(local(2026, 3, 10, 2, 59), 3)).toBe('2026-03-09')
    expect(dayKeyFor(local(2026, 3, 1, 1), 3)).toBe('2026-02-28')
    expect(dayKeyFor(local(2027, 1, 1, 2), 3)).toBe('2026-12-31')
  })

  it('starts the new day exactly at the start hour', () => {
    expect(dayKeyFor(local(2026, 3, 10, 3), 3)).toBe('2026-03-10')
  })

  it('behaves like the plain local date when the day starts at midnight', () => {
    expect(dayKeyFor(local(2026, 3, 10, 0), 0)).toBe('2026-03-10')
  })

  it('is stable across daylight-saving transitions', () => {
    expect(dayKeyFor(local(2026, 3, 29, 1), 3)).toBe('2026-03-28')
    expect(dayKeyFor(local(2026, 3, 29, 12), 3)).toBe('2026-03-29')
    expect(dayKeyFor(local(2026, 10, 25, 2, 30), 3)).toBe('2026-10-24')
  })
})

describe('day arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-09-25', 0)).toBe('2026-09-25')
  })

  it('measures whole days, also across DST changes', () => {
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2)
    expect(diffDays('2026-10-26', '2026-10-24')).toBe(2)
    expect(diffDays('2026-01-01', '2026-01-02')).toBe(-1)
  })

  it('lists inclusive ranges', () => {
    expect(rangeDays('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
    expect(rangeDays('2026-03-02', '2026-03-01')).toEqual([])
  })

  it('rejects malformed keys', () => {
    expect(() => addDays('2026-3-1', 1)).toThrow(RangeError)
  })

  it('formats and converts keys', () => {
    expect(formatDayKey(2026, 9, 5)).toBe('2026-09-05')
    const date = dayKeyToLocalDate('2026-09-05')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 8, 5, 0,
    ])
  })
})

describe('ISO weeks', () => {
  it('numbers weekdays from Monday', () => {
    expect(isoWeekday('2026-09-28')).toBe(1)
    expect(isoWeekday('2026-09-27')).toBe(7)
    expect(isoWeekday('2026-09-25')).toBe(5)
  })

  it('assigns week-year correctly at year boundaries', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01')
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01')
    expect(isoWeekKey('2026-09-25')).toBe('2026-W39')
  })
})
