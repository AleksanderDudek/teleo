import { describe, expect, it } from 'vitest'
import { endDayFor, isTaskActiveOn, remainingRepeats, taskDayIndex, taskDays, taskProgress } from './rules'

const task = { startDay: '2026-10-05', endDay: '2026-10-18', timesPerDay: 3 }

describe('endDayFor / taskDays', () => {
  it('spans the given number of days, both ends inclusive', () => {
    expect(endDayFor('2026-10-05', 14)).toBe('2026-10-18')
    expect(endDayFor('2026-10-05', 1)).toBe('2026-10-05')
    expect(taskDays(task)).toBe(14)
  })
})

describe('isTaskActiveOn', () => {
  it('is active from the first to the last day, never when archived', () => {
    expect(isTaskActiveOn(task, '2026-10-04')).toBe(false)
    expect(isTaskActiveOn(task, '2026-10-05')).toBe(true)
    expect(isTaskActiveOn(task, '2026-10-18')).toBe(true)
    expect(isTaskActiveOn(task, '2026-10-19')).toBe(false)
    expect(isTaskActiveOn({ ...task, archived: true }, '2026-10-10')).toBe(false)
  })
})

describe('taskDayIndex', () => {
  it('counts days from 1, with 0 before the start and days + 1 after the end', () => {
    expect(taskDayIndex(task, '2026-10-04')).toBe(0)
    expect(taskDayIndex(task, '2026-10-05')).toBe(1)
    expect(taskDayIndex(task, '2026-10-18')).toBe(14)
    expect(taskDayIndex(task, '2026-11-01')).toBe(15)
  })
})

describe('taskProgress', () => {
  it('counts today and the whole task, capping each day at its target', () => {
    const logs = ['2026-10-05', '2026-10-05', '2026-10-05', '2026-10-05', '2026-10-06', '2026-10-04']
    const progress = taskProgress(task, logs, '2026-10-06')
    expect(progress).toEqual({ doneToday: 1, remainingToday: 2, doneTotal: 4, total: 42, dayIndex: 2, days: 14, over: false, complete: false })
  })

  it('has nothing left to do outside the range, and is complete once every day was met', () => {
    const short = { startDay: '2026-10-05', endDay: '2026-10-06', timesPerDay: 1 }
    expect(taskProgress(short, [], '2026-10-04').remainingToday).toBe(0)
    const done = taskProgress(short, ['2026-10-05', '2026-10-06'], '2026-10-07')
    expect(done).toMatchObject({ doneTotal: 2, total: 2, over: true, complete: true, remainingToday: 0 })
  })
})

describe('remainingRepeats', () => {
  it('is what is left today, at least one', () => {
    expect(remainingRepeats({ remainingToday: 2 })).toBe(2)
    expect(remainingRepeats({ remainingToday: 0 })).toBe(1)
  })
})
