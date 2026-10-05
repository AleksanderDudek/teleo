import { addDays, diffDays } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'

/*
 * Daily tasks (owner request 2026-10-05): a text to say N times a day over a range of days, e.g. an affirmation three
 * times a day for two weeks. A "time" is one full repetition of the text (every sentence accepted in order), from any
 * session. Pure module: no DOM, no Dexie.
 */

export const TASK_LIMITS = {
  timesPerDay: { min: 1, max: 10 },
  days: { min: 1, max: 365 },
} as const

export interface TaskLike {
  startDay: DayKey
  /** Inclusive. */
  endDay: DayKey
  timesPerDay: number
  archived?: boolean
}

/** The last day of a task that starts on `startDay` and lasts `days` days. */
export function endDayFor(startDay: DayKey, days: number): DayKey {
  return addDays(startDay, Math.max(1, Math.round(days)) - 1)
}

/** How many days a task spans (inclusive of both ends). */
export function taskDays(task: Pick<TaskLike, 'startDay' | 'endDay'>): number {
  return diffDays(task.endDay, task.startDay) + 1
}

/** Whether `day` lies within the task's range (archived tasks are never active). */
export function isTaskActiveOn(task: TaskLike, day: DayKey): boolean {
  return !task.archived && task.startDay <= day && day <= task.endDay
}

/** 1-based day number of `day` within the task; 0 before the start, past the end after it. */
export function taskDayIndex(task: Pick<TaskLike, 'startDay' | 'endDay'>, day: DayKey): number {
  if (day < task.startDay) return 0
  const days = taskDays(task)
  return Math.min(days + 1, diffDays(day, task.startDay) + 1)
}

export interface TaskProgress {
  /** Repetitions said on `today`, capped at the day's target. */
  doneToday: number
  remainingToday: number
  /** Repetitions said over the whole task so far (each day capped at its target). */
  doneTotal: number
  /** `timesPerDay × days`. */
  total: number
  dayIndex: number
  days: number
  /** `today` is past the last day. */
  over: boolean
  /** Every day's target was met. */
  complete: boolean
}

/** Progress of a task from the days its repetitions were logged on. */
export function taskProgress(task: TaskLike, logDays: ReadonlyArray<DayKey>, today: DayKey): TaskProgress {
  const perDay = new Map<DayKey, number>()
  for (const day of logDays) {
    if (day >= task.startDay && day <= task.endDay) perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  const cap = (count: number) => Math.min(task.timesPerDay, count)
  const doneToday = cap(perDay.get(today) ?? 0)
  const days = taskDays(task)
  const total = task.timesPerDay * days
  const doneTotal = [...perDay.values()].reduce((sum, count) => sum + cap(count), 0)
  return {
    doneToday,
    remainingToday: isTaskActiveOn(task, today) ? task.timesPerDay - doneToday : 0,
    doneTotal,
    total,
    dayIndex: taskDayIndex(task, today),
    days,
    over: today > task.endDay,
    complete: doneTotal >= total,
  }
}

/** The repetitions a run started from the task should hold: what is left today, at least one. */
export function remainingRepeats(progress: Pick<TaskProgress, 'remainingToday'>): number {
  return Math.max(1, progress.remainingToday)
}
