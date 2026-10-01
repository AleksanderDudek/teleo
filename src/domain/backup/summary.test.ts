import { describe, expect, it } from 'vitest'
import type { DailyStats } from '@/db/types'
import { compareSummaries, hasProgress, summarizeBackup, type BackupSummary } from './summary'

const day = (dayKey: string, segmentsAccepted: number): DailyStats => ({
  dayKey,
  segmentsAccepted,
  attempts: segmentsAccepted,
  textsCompleted: 0,
  sessionsCompleted: 0,
  xp: 0,
  langs: ['pl'],
  goalReached: false,
  frozen: segmentsAccepted === 0,
  morning: false,
  evening: false,
  firstTryAccepted: 0,
})

const text = (id: string, source: 'builtin' | 'user' | 'bible' | 'dialogue') => ({
  id,
  title: id,
  type: 'text' as const,
  lang: 'pl' as const,
  body: '',
  source,
  tags: [],
  archived: false,
  splitMode: 'sentence' as const,
  createdAt: 0,
  updatedAt: 0,
})

describe('summarizeBackup', () => {
  it('counts what a person would miss: sentences, days, points, own texts, achievements, readings', () => {
    const summary = summarizeBackup({
      dailyStats: [day('2026-09-28', 12), day('2026-09-29', 0), day('2026-09-30', 5)],
      texts: [text('a', 'builtin'), text('b', 'user'), text('c', 'user'), text('d', 'dialogue')],
      xpLedger: [
        { timestamp: 1, dayKey: '2026-09-28', reason: 'segment', amount: 40 },
        { timestamp: 2, dayKey: '2026-09-30', reason: 'dailyGoal', amount: 50 },
      ],
      achievements: [{ key: 'streak.2', ruleId: 'streak.2', tier: 'bronze', xp: 50, unlockedAt: 2 }],
      bibleReadings: [{ readingId: 'kjv.GEN.0', translation: 'kjv', book: 'GEN', index: 0, ofBook: 60, completedAt: 1, dayKey: '2026-09-30', skipped: 0 }],
    })
    expect(summary).toEqual({
      sentences: 17,
      activeDays: 2,
      lastActiveDay: '2026-09-30',
      xp: 90,
      ownTexts: 2,
      achievements: 1,
      bibleReadings: 1,
    })
  })

  it('handles an empty install and backups without the later tables', () => {
    const summary = summarizeBackup({ dailyStats: [], texts: [], xpLedger: [], achievements: [] })
    expect(summary).toEqual({ sentences: 0, activeDays: 0, lastActiveDay: undefined, xp: 0, ownTexts: 0, achievements: 0, bibleReadings: 0 })
    expect(hasProgress(summary)).toBe(false)
  })
})

describe('compareSummaries', () => {
  const base: BackupSummary = { sentences: 100, activeDays: 10, lastActiveDay: '2026-09-30', xp: 2000, ownTexts: 1, achievements: 5, bibleReadings: 0 }

  it('warns when the file would take progress away from this device', () => {
    expect(compareSummaries({ ...base, xp: 1500, sentences: 80, lastActiveDay: '2026-09-20' }, base)).toEqual({ older: true, lessProgress: true })
  })

  it('is quiet when the file holds as much or more', () => {
    expect(compareSummaries(base, base)).toEqual({ older: false, lessProgress: false })
    expect(compareSummaries({ ...base, xp: 2500, lastActiveDay: '2026-10-01' }, base)).toEqual({ older: false, lessProgress: false })
  })

  it('never warns for a device without progress (a new phone)', () => {
    const empty: BackupSummary = { sentences: 0, activeDays: 0, lastActiveDay: undefined, xp: 0, ownTexts: 0, achievements: 0, bibleReadings: 0 }
    expect(compareSummaries(base, empty)).toEqual({ older: false, lessProgress: false })
  })

  it('counts own texts as progress too', () => {
    expect(hasProgress({ ...base, sentences: 0, activeDays: 0, xp: 0, lastActiveDay: undefined, achievements: 0 })).toBe(true)
    expect(compareSummaries({ ...base, ownTexts: 0 }, base).lessProgress).toBe(true)
  })
})
