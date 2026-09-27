import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { startBibleReading } from './bible'
import { finishRun, recordAttempt, skipEntry, type Evaluation } from './practice'
import { updateAppSettings } from './settings'

const GEN = {
  t: 'kjv',
  b: 'GEN',
  v: [
    [1, 1, 'In the beginning God created the heaven and the earth.'],
    [1, 2, 'And the earth was without form, and void.'],
    [1, 3, 'And God said, Let there be light: and there was light.'],
  ],
  r: [
    [1, 1, 1, 2, 18],
    [1, 3, 1, 3, 11],
  ],
}

const ok: Evaluation = { accepted: true, coverage: 1, extra: 0, wrong: 0, transcript: 'ok' }
const bad: Evaluation = { accepted: false, coverage: 0.2, extra: 2, wrong: 0, transcript: 'no' }
const at = (minute: number) => new Date(2026, 8, 27, 12, minute).getTime()

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ dayStartHour: 3, dailyGoal: 50 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('bible/kjv/GEN.json')) return new Response(JSON.stringify(GEN))
      return new Response('not found', { status: 404 })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('startBibleReading', () => {
  it('turns a reading into a hidden text of its sentences and starts it', async () => {
    const run = await startBibleReading({ translation: 'kjv', book: 'GEN', index: 0, title: 'Genesis 1:1–2' }, at(0))
    const text = await db.texts.get('bible:kjv.GEN.0')
    expect(text).toMatchObject({ source: 'bible', lang: 'en', type: 'text', title: 'Genesis 1:1–2', bible: { translation: 'kjv', book: 'GEN', index: 0, ofBook: 2 } })
    const segments = await db.segments.where('textId').equals('bible:kjv.GEN.0').sortBy('order')
    expect(segments.map((s) => s.content)).toEqual(['In the beginning God created the heaven and the earth.', 'And the earth was without form, and void.'])
    expect(run).toMatchObject({ textId: 'bible:kjv.GEN.0', title: 'Genesis 1:1–2' })
    expect(run.plan).toHaveLength(2)
  })

  it('reuses the text when the same reading is started again', async () => {
    await startBibleReading({ translation: 'kjv', book: 'GEN', index: 1, title: 'Genesis 1:3' }, at(0))
    await startBibleReading({ translation: 'kjv', book: 'GEN', index: 1, title: 'Genesis 1:3' }, at(1))
    expect(await db.texts.where('source').equals('bible').count()).toBe(1)
    expect(await db.segments.where('textId').equals('bible:kjv.GEN.1').count()).toBe(1)
  })

  it('rejects a reading that does not exist', async () => {
    await expect(startBibleReading({ translation: 'kjv', book: 'GEN', index: 7, title: 'x' }, at(0))).rejects.toThrow('no reading 7')
  })
})

describe('finishing a reading', () => {
  it('records it, unlocks the first Bible achievement and no per-text ones', async () => {
    const run = await startBibleReading({ translation: 'kjv', book: 'GEN', index: 0, title: 'Genesis 1:1–2' }, at(0))
    await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(1) })
    await recordAttempt({ runId: run.id, entryIndex: 1, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(2) })
    const outcome = await finishRun(run.id, at(3))
    expect(await db.bibleReadings.get('kjv.GEN.0')).toMatchObject({ translation: 'kjv', book: 'GEN', index: 0, ofBook: 2, dayKey: '2026-09-27', skipped: 0 })
    const keys = (await db.achievements.toCollection().primaryKeys()) as string[]
    expect(keys).toContain('bible.readings.1')
    expect(keys.filter((k) => k.includes('bible:'))).toEqual([])
    expect(outcome.bibleReading).toEqual({ readingId: 'kjv.GEN.0', first: true })
  })

  it('counts a reading with a sentence skipped after three tries, without the session bonus', async () => {
    const run = await startBibleReading({ translation: 'kjv', book: 'GEN', index: 0, title: 'Genesis 1:1–2' }, at(0))
    await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(1) })
    for (let i = 0; i < 3; i++) await recordAttempt({ runId: run.id, entryIndex: 1, evaluation: bad, engine: 'webspeech', durationMs: 1, now: at(2) })
    await skipEntry(run.id, 1, at(3))
    const outcome = await finishRun(run.id, at(4))
    expect(outcome.clean).toBe(false)
    expect(await db.bibleReadings.get('kjv.GEN.0')).toMatchObject({ skipped: 1 })
    expect((await db.xpLedger.where('reason').equals('sessionComplete').count())).toBe(0)
  })

  it('completes a book when all its readings are read', async () => {
    for (const index of [0, 1]) {
      const run = await startBibleReading({ translation: 'kjv', book: 'GEN', index, title: `r${index}` }, at(index * 10))
      for (let i = 0; i < run.plan.length; i++) await recordAttempt({ runId: run.id, entryIndex: i, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(index * 10 + i + 1) })
      await finishRun(run.id, at(index * 10 + 5))
    }
    const keys = (await db.achievements.toCollection().primaryKeys()) as string[]
    expect(keys).toContain('bible.books.1')
  })
})
