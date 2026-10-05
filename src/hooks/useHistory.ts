import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { historyTotals, runHistoryRow, type HistoryRow, type HistoryTotals } from '@/domain/session/history'
import { dayKeyFor } from '@/domain/time/dayKey'

export interface HistoryText {
  title: string
  /** Bible readings are hidden texts: the history links them to the Bible, not the library. */
  bible: boolean
}

export interface HistoryData {
  rows: HistoryRow[]
  /** Runs in all (the rows are the newest `limit`). */
  count: number
  totals: HistoryTotals
  texts: Map<string, HistoryText>
  /** Title of the text behind each task a listed run was started from. */
  tasks: Map<string, string>
}

/** The newest `limit` runs with what they were about, kept live. */
export function useHistory(limit: number, dayStartHour: number): HistoryData | undefined {
  return useLiveQuery(async () => {
    const today = dayKeyFor(Date.now(), dayStartHour)
    // The totals walk every run but keep three numbers of each (a long Bible history is heavy to hold whole).
    const totalsOf: Array<Pick<HistoryRow, 'dayKey' | 'durationMs' | 'accepted'>> = []
    const [newest] = await Promise.all([
      db.sessionRuns.orderBy('startedAt').reverse().limit(limit).toArray(),
      db.sessionRuns.each((run) => {
        const { dayKey, durationMs, accepted } = runHistoryRow(run)
        totalsOf.push({ dayKey, durationMs, accepted })
      }),
    ])
    const count = totalsOf.length
    const rows = newest.map(runHistoryRow)
    const textIds = new Set(rows.flatMap((row) => row.textIds))
    const taskIds = [...new Set(rows.flatMap((row) => (row.taskId ? [row.taskId] : [])))]
    const tasksById = new Map((await db.tasks.bulkGet(taskIds)).flatMap((task) => (task ? [[task.id, task] as const] : [])))
    for (const task of tasksById.values()) textIds.add(task.textId)
    const texts = new Map<string, HistoryText>()
    for (const text of await db.texts.bulkGet([...textIds])) if (text) texts.set(text.id, { title: text.title, bible: text.source === 'bible' })
    const tasks = new Map([...tasksById].map(([id, task]) => [id, texts.get(task.textId)?.title ?? '']))
    return { rows, count, totals: historyTotals(totalsOf, today), texts, tasks }
  }, [limit, dayStartHour])
}
