import type { DayKey } from '@/domain/types'
import { diffDays } from '@/domain/time/dayKey'
import { summarizeRun } from './progress'
import type { EntryState, PlanEntry } from './types'

/** The fields of a `SessionRun` row the history reads. */
export interface RunLike {
  id: string
  title: string
  dayKey: DayKey
  startedAt: number
  endedAt?: number
  lastActivityAt: number
  status: 'in_progress' | 'completed' | 'partial'
  mode: 'read' | 'memory'
  plan: readonly PlanEntry[]
  entries: readonly EntryState[]
  xpEarned: number
  taskId?: string
}

export interface HistoryRow {
  id: string
  title: string
  dayKey: DayKey
  startedAt: number
  /** Until the run ended, or its last activity while it is still open. */
  durationMs: number
  status: RunLike['status']
  mode: RunLike['mode']
  taskId?: string
  /** The texts said, in the order they first appear in the plan. */
  textIds: string[]
  accepted: number
  total: number
  skipped: number
  firstTryRate: number
  textsCompleted: number
  xpEarned: number
}

/** One line of the session history (owner request 2026-10-05): what a run was about and what was done in it. */
export function runHistoryRow(run: RunLike): HistoryRow {
  const summary = summarizeRun(run.plan, run.entries)
  const textIds: string[] = []
  for (const entry of run.plan) if (!textIds.includes(entry.textId)) textIds.push(entry.textId)
  return {
    id: run.id,
    title: run.title,
    dayKey: run.dayKey,
    startedAt: run.startedAt,
    durationMs: Math.max(0, (run.endedAt ?? run.lastActivityAt) - run.startedAt),
    status: run.status,
    mode: run.mode,
    ...(run.taskId ? { taskId: run.taskId } : {}),
    textIds,
    accepted: summary.accepted,
    total: summary.total,
    skipped: summary.skipped,
    firstTryRate: summary.firstTryRate,
    textsCompleted: summary.textsCompleted,
    xpEarned: run.xpEarned,
  }
}

export interface HistoryPeriod {
  sessions: number
  /** Whole minutes, rounded. */
  minutes: number
}

export interface HistoryTotals {
  last7: HistoryPeriod
  last30: HistoryPeriod
  all: HistoryPeriod
}

const period = (rows: ReadonlyArray<Pick<HistoryRow, 'durationMs'>>): HistoryPeriod => ({
  sessions: rows.length,
  minutes: Math.round(rows.reduce((sum, row) => sum + row.durationMs, 0) / 60_000),
})

/** Sessions and minutes in the last 7 and 30 days (today included) and in all; only runs with something said count. */
export function historyTotals(rows: ReadonlyArray<Pick<HistoryRow, 'dayKey' | 'durationMs' | 'accepted'>>, today: DayKey): HistoryTotals {
  const said = rows.filter((row) => row.accepted > 0)
  const within = (days: number) => said.filter((row) => diffDays(today, row.dayKey) < days && diffDays(today, row.dayKey) >= 0)
  return { last7: period(within(7)), last30: period(within(30)), all: period(said) }
}
