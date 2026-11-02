import { describe, expect, it } from 'vitest'
import type { SessionTemplate, TaskLogRow, TaskRow } from '@/db/types'
import { dialogueRows, retiredBuiltinRows, textRows, withTextRows } from '@/test/textRows'
import { isRetiredTemplate, isRetiredText, RETIRED_BUILTIN_SESSIONS, RETIRED_BUILTIN_TEXTS, RETIRED_TEXT_SOURCES, retiredRows, withoutRetiredRows } from './retired'
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

  it('is true for the builtin Hail Mary in both languages, whatever the source of a text with its key', () => {
    expect(RETIRED_BUILTIN_TEXTS).toEqual(['pl.zdrowas-maryjo', 'en.hail-mary'])
    for (const builtinKey of RETIRED_BUILTIN_TEXTS) expect(isRetiredText({ source: 'builtin', builtinKey })).toBe(true)
    expect(isRetiredText({ source: 'builtin', builtinKey: 'en.lords-prayer' })).toBe(false)
    expect(isRetiredText({ source: 'user', builtinKey: 'en.hail-mary' })).toBe(false)
  })
})

const template = (id: string, items: SessionTemplate['items'], builtinKey?: string): SessionTemplate => ({
  id,
  name: id,
  pinned: false,
  items,
  createdAt: 1,
  updatedAt: 1,
  source: builtinKey ? 'builtin' : 'user',
  archived: false,
  ...(builtinKey ? { builtinKey } : {}),
})

describe('isRetiredTemplate', () => {
  it('is true for the builtin rosary decades only', () => {
    expect(RETIRED_BUILTIN_SESSIONS).toEqual(['pl.dziesiatka-rozanca', 'en.decade-of-the-rosary'])
    for (const key of RETIRED_BUILTIN_SESSIONS) expect(isRetiredTemplate(template(`builtin:${key}`, [], key))).toBe(true)
    expect(isRetiredTemplate(template('builtin:en.psalm-91-session', [], 'en.psalm-91-session'))).toBe(false)
    expect(isRetiredTemplate(template('own', []))).toBe(false)
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
    expect(retired.sessionRun({ ...own.run, textId: undefined })).toBe(false)
  })

  it('finds the unfinished session runs that hold a retired text and keeps the finished ones', () => {
    const hail = retiredBuiltinRows()
    const mixed = retiredRows([hail.text, own.text])
    const plan = [...own.run.plan, ...hail.run.plan]
    const session = { ...own.run, textId: undefined, templateId: 'own-session', plan }
    expect(mixed.sessionRun({ ...session, status: 'partial' })).toBe(true)
    expect(mixed.sessionRun({ ...session, status: 'in_progress' })).toBe(true)
    expect(mixed.sessionRun({ ...session, status: 'completed' })).toBe(false)
  })

  it('takes the retired texts out of a session and returns other sessions unchanged', () => {
    const hail = retiredBuiltinRows()
    const mixed = retiredRows([hail.text, own.text])
    const ownSession = template('own-session', [{ textId: own.text.id, repeat: 1 }, { textId: hail.text.id, repeat: 10 }])
    expect(mixed.template(ownSession)).toEqual({ ...ownSession, items: [{ textId: own.text.id, repeat: 1 }] })
    const untouched = template('other', [{ textId: own.text.id, repeat: 2 }])
    expect(mixed.template(untouched)).toBe(untouched)
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

  it('drops the Hail Mary, the rosary decades and the tasks of the prayer; keeps other sessions without it', () => {
    const hail = retiredBuiltinRows()
    const own = textRows('own', 'user')
    const decade = template('builtin:en.decade-of-the-rosary', [{ textId: hail.text.id, repeat: 10 }], 'en.decade-of-the-rosary')
    const mine = template('mine', [{ textId: own.text.id, repeat: 1 }, { textId: hail.text.id, repeat: 3 }])
    const task = (id: string, textId: string): TaskRow => ({ id, textId, timesPerDay: 1, startDay: '2026-09-30', endDay: '2026-10-06', createdAt: 1, archived: false })
    const log = (id: string, taskId: string): TaskLogRow => ({ id, taskId, dayKey: '2026-09-30', runId: 'run', timestamp: 1 })
    const data: BackupData = {
      ...withTextRows(empty(), own, hail),
      sessionTemplates: [decade, mine],
      tasks: [task('t-hail', hail.text.id), task('t-own', own.text.id)],
      taskLog: [log('l-hail', 't-hail'), log('l-own', 't-own')],
    }

    expect(withoutRetiredRows(data)).toEqual({
      ...withTextRows(empty(), own),
      attempts: data.attempts,
      xpLedger: data.xpLedger,
      sessionTemplates: [{ ...mine, items: [{ textId: own.text.id, repeat: 1 }] }],
      tasks: [task('t-own', own.text.id)],
      taskLog: [log('l-own', 't-own')],
    })
  })

  it('drops a retired builtin session even when its texts are not in the file', () => {
    const decade = template('builtin:pl.dziesiatka-rozanca', [], 'pl.dziesiatka-rozanca')
    expect(withoutRetiredRows({ ...empty(), sessionTemplates: [decade] }).sessionTemplates).toEqual([])
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
