import { describe, expect, it } from 'vitest'
import { reminderNudge, reminderStateFrom } from './nudge'

describe('reminderNudge', () => {
  it('names the task repetitions left today, with Polish plural forms', () => {
    expect(reminderNudge({ lang: 'pl', saidToday: true, tasksRemaining: 1 })).toEqual({ title: 'Czas na Teleo', body: 'Do powiedzenia dziś: 1 powtórzenie zadań.' })
    expect(reminderNudge({ lang: 'pl', saidToday: false, tasksRemaining: 3 })?.body).toBe('Do powiedzenia dziś: 3 powtórzenia zadań.')
    expect(reminderNudge({ lang: 'pl', saidToday: false, tasksRemaining: 12 })?.body).toBe('Do powiedzenia dziś: 12 powtórzeń zadań.')
    expect(reminderNudge({ lang: 'pl', saidToday: false, tasksRemaining: 22 })?.body).toBe('Do powiedzenia dziś: 22 powtórzenia zadań.')
    expect(reminderNudge({ lang: 'en', saidToday: true, tasksRemaining: 2 })).toEqual({ title: 'Time for Teleo', body: '2 task repetitions left today.' })
    expect(reminderNudge({ lang: 'en', saidToday: true, tasksRemaining: 1 })?.body).toBe('1 task repetition left today.')
  })

  it('asks for one sentence when nothing was said and no task is due', () => {
    expect(reminderNudge({ lang: 'pl', saidToday: false, tasksRemaining: 0 })?.body).toBe('Wypowiedz dziś choć jedno zdanie na głos.')
    expect(reminderNudge({ lang: 'en', saidToday: false, tasksRemaining: 0 })?.body).toBe('Say at least one sentence aloud today.')
  })

  it('stays quiet once something was said and nothing is due', () => {
    expect(reminderNudge({ lang: 'pl', saidToday: true, tasksRemaining: 0 })).toBeNull()
  })
})

describe('reminderStateFrom', () => {
  const tasks = [
    { id: 'a', startDay: '2026-10-01', endDay: '2026-10-14', timesPerDay: 3 },
    { id: 'b', startDay: '2026-10-05', endDay: '2026-10-05', timesPerDay: 2 },
    { id: 'old', startDay: '2026-09-01', endDay: '2026-09-30', timesPerDay: 5 },
    { id: 'off', startDay: '2026-10-01', endDay: '2026-10-14', timesPerDay: 4, archived: true },
  ]

  it('sums what active tasks still need today and reads the day from the stats', () => {
    const logs = [
      { taskId: 'a', dayKey: '2026-10-05' },
      { taskId: 'a', dayKey: '2026-10-04' },
      { taskId: 'b', dayKey: '2026-10-05' },
      { taskId: 'b', dayKey: '2026-10-05' },
      { taskId: 'b', dayKey: '2026-10-05' },
    ]
    expect(reminderStateFrom({ lang: 'pl', today: '2026-10-05', segmentsAccepted: 4, tasks, logs })).toEqual({ lang: 'pl', saidToday: true, tasksRemaining: 2 })
  })

  it('counts nothing said without a stats row', () => {
    expect(reminderStateFrom({ lang: 'en', today: '2026-10-05', segmentsAccepted: 0, tasks: [], logs: [] })).toEqual({ lang: 'en', saidToday: false, tasksRemaining: 0 })
  })
})
