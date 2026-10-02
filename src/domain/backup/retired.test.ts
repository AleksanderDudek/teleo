import { describe, expect, it } from 'vitest'
import { dialogueRows, textRows, withTextRows } from '@/test/textRows'
import { isRetiredText, RETIRED_TEXT_SOURCES, retiredRows, withoutRetiredRows } from './retired'
import type { BackupData } from './validate'

const empty = (): BackupData => ({
  texts: [],
  segments: [],
  sessionTemplates: [],
  sessionRuns: [],
  attempts: [],
  dailyStats: [],
  textStats: [],
  achievements: [],
  xpLedger: [],
  settings: [],
})

describe('isRetiredText', () => {
  it('is true for the texts of language dialogues only', () => {
    expect(RETIRED_TEXT_SOURCES).toEqual(['dialogue'])
    expect(isRetiredText({ source: 'dialogue' })).toBe(true)
    for (const source of ['builtin', 'user', 'bible']) expect(isRetiredText({ source })).toBe(false)
  })
})

describe('retiredRows', () => {
  const cafe = dialogueRows('cafe', 'en')
  const own = textRows('own', 'user')
  const retired = retiredRows([cafe.text, own.text])

  it('names the retired texts', () => {
    expect([...retired.textIds]).toEqual([cafe.text.id])
  })

  it('finds the rows that belong to them: segments, stats, per-text achievements and runs', () => {
    expect(cafe.segments.every(retired.segment)).toBe(true)
    expect(retired.textStats(cafe.textStats)).toBe(true)
    expect(retired.achievement(cafe.achievement)).toBe(true)
    expect(retired.sessionRun(cafe.run)).toBe(true)

    expect(own.segments.some(retired.segment)).toBe(false)
    expect(retired.textStats(own.textStats)).toBe(false)
    expect(retired.achievement(own.achievement)).toBe(false)
    expect(retired.sessionRun(own.run)).toBe(false)
  })

  it('leaves global achievements and session runs without a text alone', () => {
    expect(retired.achievement({ textId: undefined })).toBe(false)
    expect(retired.sessionRun({ textId: undefined })).toBe(false)
  })
})

describe('withoutRetiredRows', () => {
  it('drops the dialogue rows and keeps the progress earned with them (attempts, daily stats, points)', () => {
    const cafe = dialogueRows('cafe', 'en')
    const station = dialogueRows('station', 'pl')
    const own = textRows('own', 'user')
    const bible = textRows('bible:kjv.GEN.0', 'bible', 'en')
    const day = { dayKey: '2026-09-30', segmentsAccepted: 8, attempts: 8, textsCompleted: 4, sessionsCompleted: 4, xp: 80, langs: ['en' as const], goalReached: true, frozen: false, morning: false, evening: false, firstTryAccepted: 8 }
    const data = { ...withTextRows(empty(), own, cafe, bible, station), dailyStats: [day] }

    const kept = withoutRetiredRows(data)

    expect(kept).toEqual({
      ...withTextRows(empty(), own, bible),
      dailyStats: [day],
      attempts: data.attempts,
      xpLedger: data.xpLedger,
    })
  })

  it('returns data without dialogues unchanged', () => {
    const data = withTextRows(empty(), textRows('own', 'user'))
    expect(withoutRetiredRows(data)).toBe(data)
  })

  it('keeps the optional tables of the backup as they are', () => {
    const reading = { readingId: 'kjv.GEN.0', translation: 'kjv' as const, book: 'GEN', index: 0, ofBook: 60, completedAt: 1, dayKey: '2026-09-30', skipped: 0 }
    const data = { ...withTextRows(empty(), dialogueRows()), bibleReadings: [reading] }
    expect(withoutRetiredRows(data)).toMatchObject({ bibleReadings: [reading], texts: [] })
    expect(withoutRetiredRows(data)).not.toHaveProperty('friends')
  })
})
