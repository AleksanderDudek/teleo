import { describe, expect, it } from 'vitest'
import { clockDayOf, isReminderTime, nextReminderAt, normalizeReminderTimes, passedReminderToday, sortReminderTimes } from './times'

describe('isReminderTime', () => {
  it.each(['00:00', '07:00', '23:59', '13:05'])('accepts %s', (time) => expect(isReminderTime(time)).toBe(true))
  it.each(['7:00', '24:00', '07:60', '07:00:00', ' 07:00', '', 7, null, undefined])('rejects %j', (time) => expect(isReminderTime(time)).toBe(false))
})

describe('normalizeReminderTimes', () => {
  it('keeps valid, distinct times in order and drops the rest', () => {
    expect(normalizeReminderTimes(['21:00', 'x', '07:00', '21:00', 7, '13:00'])).toEqual(['21:00', '07:00', '13:00'])
  })
  it('caps the list at three', () => {
    expect(normalizeReminderTimes(['01:00', '02:00', '03:00', '04:00'])).toEqual(['01:00', '02:00', '03:00'])
  })
  it('is empty when nothing is valid', () => {
    expect(normalizeReminderTimes(['bad', ''])).toEqual([])
  })
})

describe('sortReminderTimes', () => {
  it('orders by the clock', () => {
    expect(sortReminderTimes(['21:00', '07:30', '07:05', '13:00'])).toEqual(['07:05', '07:30', '13:00', '21:00'])
  })
})

describe('nextReminderAt', () => {
  const times = ['21:00', '07:00', '13:00']
  it('is the next time later today', () => {
    expect(nextReminderAt(times, new Date(2026, 9, 5, 8, 15))).toEqual(new Date(2026, 9, 5, 13, 0))
    expect(nextReminderAt(times, new Date(2026, 9, 5, 0, 0))).toEqual(new Date(2026, 9, 5, 7, 0))
  })
  it('skips a time that is exactly now', () => {
    expect(nextReminderAt(times, new Date(2026, 9, 5, 13, 0))).toEqual(new Date(2026, 9, 5, 21, 0))
  })
  it('wraps to the earliest time tomorrow after the last one', () => {
    expect(nextReminderAt(times, new Date(2026, 9, 5, 21, 30))).toEqual(new Date(2026, 9, 6, 7, 0))
    // Across the end of a month too.
    expect(nextReminderAt(times, new Date(2026, 9, 31, 23, 0))).toEqual(new Date(2026, 10, 1, 7, 0))
  })
  it('is null without any valid time', () => {
    expect(nextReminderAt([], new Date())).toBeNull()
    expect(nextReminderAt(['nope'], new Date())).toBeNull()
  })
})

describe('passedReminderToday', () => {
  const times = ['07:00', '13:00', '21:00']
  it('is the latest time already due today', () => {
    expect(passedReminderToday(times, new Date(2026, 9, 5, 6, 59))).toBeNull()
    expect(passedReminderToday(times, new Date(2026, 9, 5, 7, 0))).toBe('07:00')
    expect(passedReminderToday(times, new Date(2026, 9, 5, 14, 0))).toBe('13:00')
    expect(passedReminderToday(times, new Date(2026, 9, 5, 23, 59))).toBe('21:00')
  })
})

describe('clockDayOf', () => {
  it('is the local calendar day, whatever the app day start', () => {
    expect(clockDayOf(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05')
  })
})
