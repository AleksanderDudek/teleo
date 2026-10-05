import { describe, expect, it } from 'vitest'
import { historyTotals, runHistoryRow, type RunLike } from './history'
import type { EntryState } from './types'

const entry = (status: EntryState['status'], firstTry = status === 'accepted'): EntryState => ({ status, attempts: 1, firstTry, xp: 7 })

const run: RunLike = {
  id: 'r1',
  title: 'Dziesiątka',
  dayKey: '2026-10-05',
  startedAt: 1_000_000,
  endedAt: 1_000_000 + 4 * 60_000,
  lastActivityAt: 1_000_000 + 3 * 60_000,
  status: 'completed',
  mode: 'read',
  plan: [
    { segmentId: 'a0', textId: 'A', block: 0, fullText: true, item: 0 },
    { segmentId: 'a1', textId: 'A', block: 0, fullText: true, item: 0 },
    { segmentId: 'b0', textId: 'B', block: 1, fullText: true, item: 1 },
    { segmentId: 'a0', textId: 'A', block: 2, fullText: true, item: 2 },
  ],
  entries: [entry('accepted'), entry('accepted', false), entry('skipped'), entry('accepted')],
  xpEarned: 40,
  taskId: 'task1',
}

describe('runHistoryRow', () => {
  it('describes a run: its texts in plan order, what was said, how long it took', () => {
    expect(runHistoryRow(run)).toEqual({
      id: 'r1',
      title: 'Dziesiątka',
      dayKey: '2026-10-05',
      startedAt: 1_000_000,
      durationMs: 4 * 60_000,
      status: 'completed',
      mode: 'read',
      taskId: 'task1',
      textIds: ['A', 'B'],
      accepted: 3,
      total: 4,
      skipped: 1,
      firstTryRate: 0.5,
      textsCompleted: 2,
      xpEarned: 40,
    })
  })

  it('measures an open run up to its last activity, and never below zero', () => {
    const { endedAt: _ended, ...open } = run
    expect(runHistoryRow({ ...open, status: 'partial' }).durationMs).toBe(3 * 60_000)
    expect(runHistoryRow({ ...open, lastActivityAt: 10 }).durationMs).toBe(0)
    expect(runHistoryRow({ ...open, taskId: undefined })).not.toHaveProperty('taskId')
  })
})

describe('historyTotals', () => {
  it('counts sessions with something said, and their minutes, in the last 7 and 30 days and in all', () => {
    const rows = [
      { dayKey: '2026-10-05', durationMs: 90_000, accepted: 3 },
      { dayKey: '2026-10-01', durationMs: 150_000, accepted: 1 },
      { dayKey: '2026-09-20', durationMs: 60_000, accepted: 2 },
      { dayKey: '2026-08-01', durationMs: 600_000, accepted: 5 },
      { dayKey: '2026-10-05', durationMs: 20_000, accepted: 0 },
      { dayKey: '2026-10-09', durationMs: 20_000, accepted: 1 },
    ]
    expect(historyTotals(rows, '2026-10-05')).toEqual({
      last7: { sessions: 2, minutes: 4 },
      last30: { sessions: 3, minutes: 5 },
      all: { sessions: 5, minutes: 15 },
    })
  })
})
