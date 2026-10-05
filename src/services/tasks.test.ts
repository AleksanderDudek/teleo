import { beforeEach, describe, expect, it } from 'vitest'
import { builtinTextId } from '@/content'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { finishRun, recordAttempt, type Evaluation } from './practice'
import { seedBuiltins } from './seed'
import { startRun } from './sessions'
import { updateAppSettings } from './settings'
import { createTask, deleteTask, logTaskRepetition, repetitionsDueToday, setTaskArchived, TaskError, tasksDueToday, taskViews, updateTask } from './tasks'
import { createText, deleteUserText } from './texts'

const at = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const ok: Evaluation = { accepted: true, coverage: 1, extra: 0, wrong: 0, transcript: 'ok' }
const GLORY = builtinTextId('pl.chwala-ojcu') // two sentences

/** Says every line of a run once, from `start` on, a second apart. */
async function speakAll(runId: string, total: number, start: number) {
  for (let i = 0; i < total; i++) await recordAttempt({ runId, entryIndex: i, evaluation: ok, engine: 'webspeech', durationMs: 900, now: start + (i + 1) * 1000 })
}

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', dailyGoal: 10, dayStartHour: 3 })
  await seedBuiltins()
})

describe('createTask / updateTask', () => {
  it('stores the text, the daily target and the day range', async () => {
    const task = await createTask({ textId: GLORY, timesPerDay: 3, startDay: '2026-10-05', days: 14 }, at(5))
    expect(task).toMatchObject({ textId: GLORY, timesPerDay: 3, startDay: '2026-10-05', endDay: '2026-10-18', archived: false, createdAt: at(5) })
    const changed = await updateTask(task.id, { textId: GLORY, timesPerDay: 2, startDay: '2026-10-06', days: 7 })
    expect(changed).toMatchObject({ id: task.id, timesPerDay: 2, startDay: '2026-10-06', endDay: '2026-10-12' })
  })

  it('keeps the log when only the target or range changes, and empties it when the text changes', async () => {
    const task = await createTask({ textId: GLORY, timesPerDay: 3, startDay: '2026-10-05', days: 14 }, at(5))
    await logTaskRepetition(GLORY, '2026-10-05', 'run1', at(5))
    await updateTask(task.id, { textId: GLORY, timesPerDay: 2, startDay: '2026-10-05', days: 7 })
    expect(await db.taskLog.where('taskId').equals(task.id).count()).toBe(1)
    const other = (await db.texts.toArray()).find((text) => text.id !== GLORY && text.lang === 'pl')?.id ?? ''
    await updateTask(task.id, { textId: other, timesPerDay: 2, startDay: '2026-10-05', days: 7 })
    expect(await db.taskLog.where('taskId').equals(task.id).count()).toBe(0)
  })

  it.each([
    [{ textId: 'nope', timesPerDay: 3, startDay: '2026-10-05', days: 14 }, 'noText'],
    [{ textId: GLORY, timesPerDay: 0, startDay: '2026-10-05', days: 14 }, 'timesPerDay'],
    [{ textId: GLORY, timesPerDay: 11, startDay: '2026-10-05', days: 14 }, 'timesPerDay'],
    [{ textId: GLORY, timesPerDay: 2.5, startDay: '2026-10-05', days: 14 }, 'timesPerDay'],
    [{ textId: GLORY, timesPerDay: 3, startDay: '2026-10-05', days: 0 }, 'days'],
    [{ textId: GLORY, timesPerDay: 3, startDay: '2026-10-05', days: 366 }, 'days'],
    [{ textId: GLORY, timesPerDay: 3, startDay: 'tomorrow', days: 14 }, 'startDay'],
  ])('rejects invalid input (%#)', async (bad, code) => {
    await expect(createTask(bad)).rejects.toMatchObject({ code })
    await expect(createTask(bad)).rejects.toBeInstanceOf(TaskError)
  })
})

describe('a repetition counts for the task, whichever session said it', () => {
  it('logs each full repetition on its day and reports the task progress with the attempt', async () => {
    const task = await createTask({ textId: GLORY, timesPerDay: 2, startDay: '2026-10-05', days: 14 }, at(5))
    const run = await startRun({ kind: 'text', textId: GLORY }, at(5))
    const first = await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(5, 12, 1) })
    expect(first.taskProgress).toBeUndefined()
    const second = await recordAttempt({ runId: run.id, entryIndex: 1, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(5, 12, 2) })
    expect(second.taskProgress).toEqual([{ taskId: task.id, done: 1, of: 2 }])
    expect(await db.taskLog.toArray()).toMatchObject([{ taskId: task.id, dayKey: '2026-10-05', runId: run.id }])

    const [view] = await tasksDueToday(at(5, 13))
    expect(view?.progress).toMatchObject({ doneToday: 1, remainingToday: 1, doneTotal: 1, total: 28, dayIndex: 1, days: 14 })
    expect(await repetitionsDueToday(at(5, 13))).toBe(1)
  })

  it('counts nothing outside the task’s days or for an archived task', async () => {
    const task = await createTask({ textId: GLORY, timesPerDay: 1, startDay: '2026-10-06', days: 2 }, at(5))
    expect(await logTaskRepetition(GLORY, '2026-10-05', 'run', at(5))).toEqual([])
    expect(await logTaskRepetition(GLORY, '2026-10-06', 'run', at(6))).toEqual([{ taskId: task.id, done: 1, of: 1 }])
    await setTaskArchived(task.id, true)
    expect(await logTaskRepetition(GLORY, '2026-10-07', 'run', at(7))).toEqual([])
    expect(await tasksDueToday(at(7))).toEqual([])
  })
})

describe('a run started from a task', () => {
  it('repeats the text for what is left today, and once when the day’s target is met', async () => {
    const task = await createTask({ textId: GLORY, timesPerDay: 3, startDay: '2026-10-05', days: 14 }, at(5))
    const run = await startRun({ kind: 'task', taskId: task.id }, at(5))
    expect(run).toMatchObject({ taskId: task.id, textId: GLORY, title: 'Chwała Ojcu' })
    expect(run.plan).toHaveLength(6) // two sentences × three repetitions
    await speakAll(run.id, 6, at(5))
    await finishRun(run.id, at(5, 13))
    expect((await tasksDueToday(at(5, 14)))[0]?.progress).toMatchObject({ doneToday: 3, remainingToday: 0 })

    const extra = await startRun({ kind: 'task', taskId: task.id }, at(5, 15))
    expect(extra.plan).toHaveLength(2)
    expect((await taskViews(at(5, 16)))[0]?.progress.doneToday).toBe(3)
  })

  it('refuses a task that does not exist', async () => {
    await expect(startRun({ kind: 'task', taskId: 'nope' })).rejects.toMatchObject({ code: 'notFound' })
  })
})

describe('deleting', () => {
  it('removes a task with its log, and a user text takes its tasks with it', async () => {
    const text = await createText({ title: 'Spokój', type: 'affirmation', lang: 'pl', splitMode: 'line', segments: ['Wybieram spokój.'] })
    const task = await createTask({ textId: text.id, timesPerDay: 1, startDay: '2026-10-05', days: 3 }, at(5))
    await logTaskRepetition(text.id, '2026-10-05', 'run', at(5))
    const other = await createTask({ textId: GLORY, timesPerDay: 1, startDay: '2026-10-05', days: 3 }, at(5))
    await deleteTask(other.id)
    expect(await db.tasks.count()).toBe(1)
    await deleteUserText(text.id)
    expect(await db.tasks.get(task.id)).toBeUndefined()
    expect(await db.taskLog.count()).toBe(0)
  })
})
