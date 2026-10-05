import { db } from '@/db/schema'
import type { TaskRow, TextItem } from '@/db/types'
import { endDayFor, isTaskActiveOn, TASK_LIMITS, taskProgress, type TaskProgress } from '@/domain/tasks'
import { dayKeyFor } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'
import { newId } from '@/lib/id'
import { readSettings } from './settings'

export type TaskErrorCode = 'notFound' | 'noText' | 'timesPerDay' | 'days' | 'startDay'

export class TaskError extends Error {
  readonly code: TaskErrorCode
  constructor(code: TaskErrorCode) {
    super(`Task error: ${code}`)
    this.name = 'TaskError'
    this.code = code
  }
}

export interface TaskInput {
  textId: string
  timesPerDay: number
  startDay: DayKey
  /** Length in days, the start day included. */
  days: number
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

async function validate(input: TaskInput): Promise<void> {
  if (!(await db.texts.get(input.textId))) throw new TaskError('noText')
  const { timesPerDay, days } = input
  if (!Number.isInteger(timesPerDay) || timesPerDay < TASK_LIMITS.timesPerDay.min || timesPerDay > TASK_LIMITS.timesPerDay.max) throw new TaskError('timesPerDay')
  if (!Number.isInteger(days) || days < TASK_LIMITS.days.min || days > TASK_LIMITS.days.max) throw new TaskError('days')
  if (!DAY_KEY.test(input.startDay)) throw new TaskError('startDay')
}

/** A new daily task; its text is said `timesPerDay` times a day for `days` days from `startDay`. */
export async function createTask(input: TaskInput, now = Date.now()): Promise<TaskRow> {
  await validate(input)
  const task: TaskRow = {
    id: newId(),
    textId: input.textId,
    timesPerDay: input.timesPerDay,
    startDay: input.startDay,
    endDay: endDayFor(input.startDay, input.days),
    createdAt: now,
    archived: false,
  }
  await db.tasks.add(task)
  return task
}

/** Changes a task's text, target or range; repetitions logged outside the new range simply no longer count. */
export async function updateTask(id: string, input: TaskInput): Promise<TaskRow> {
  await validate(input)
  return db.transaction('rw', db.tasks, async () => {
    const existing = await db.tasks.get(id)
    if (!existing) throw new TaskError('notFound')
    const next: TaskRow = { ...existing, textId: input.textId, timesPerDay: input.timesPerDay, startDay: input.startDay, endDay: endDayFor(input.startDay, input.days) }
    await db.tasks.put(next)
    return next
  })
}

/** Stops a task early (or resumes it); its log stays. */
export async function setTaskArchived(id: string, archived: boolean): Promise<void> {
  await db.tasks.update(id, { archived })
}

/** Removes a task and its log; the runs and attempts that fed it stay (they are history of the text). */
export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', [db.tasks, db.taskLog], async () => {
    await db.taskLog.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}

export interface TaskView {
  task: TaskRow
  /** Absent when the text was deleted (user texts cascade, so only a damaged backup gets here). */
  text: TextItem | undefined
  progress: TaskProgress
}

/** Every task with its progress as of `now`, newest first. */
export async function taskViews(now = Date.now()): Promise<TaskView[]> {
  const { app } = await readSettings()
  const today = dayKeyFor(now, app.dayStartHour)
  const tasks = await db.tasks.toArray()
  const views: TaskView[] = []
  for (const task of tasks) {
    const [text, logs] = await Promise.all([db.texts.get(task.textId), db.taskLog.where('taskId').equals(task.id).toArray()])
    views.push({ task, text, progress: taskProgress(task, logs.map((row) => row.dayKey), today) })
  }
  return views.sort((a, b) => b.task.createdAt - a.task.createdAt)
}

/** The tasks due on the day `now` belongs to (active, with an existing text), oldest first. */
export async function tasksDueToday(now = Date.now()): Promise<TaskView[]> {
  const { app } = await readSettings()
  const today = dayKeyFor(now, app.dayStartHour)
  return (await taskViews(now)).filter((view) => view.text && isTaskActiveOn(view.task, today)).sort((a, b) => a.task.createdAt - b.task.createdAt)
}

/** Task repetitions still due today, for the app badge. */
export async function repetitionsDueToday(now = Date.now()): Promise<number> {
  return (await tasksDueToday(now)).reduce((sum, view) => sum + view.progress.remainingToday, 0)
}

export interface TaskAdvance {
  taskId: string
  done: number
  of: number
}

/**
 * Logs one full repetition of `textId` said on `dayKey` for every task of that text covering the day, and tells how
 * far each one is now. Called inside `recordAttempt`'s transaction (which covers `tasks` and `taskLog`).
 */
export async function logTaskRepetition(textId: string, dayKey: DayKey, runId: string, now: number): Promise<TaskAdvance[]> {
  const advances: TaskAdvance[] = []
  for (const task of await db.tasks.where('textId').equals(textId).toArray()) {
    if (!isTaskActiveOn(task, dayKey)) continue
    await db.taskLog.add({ id: newId(), taskId: task.id, dayKey, runId, timestamp: now })
    const done = await db.taskLog.where('[taskId+dayKey]').equals([task.id, dayKey]).count()
    advances.push({ taskId: task.id, done: Math.min(done, task.timesPerDay), of: task.timesPerDay })
  }
  return advances
}
