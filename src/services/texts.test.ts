import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import type { Attempt } from '@/db/types'
import { resetDb } from '@/test/db'
import {
  copyTextAsOwn,
  createText,
  deleteUserText,
  getActiveSegments,
  setTextArchived,
  TextValidationError,
  updateText,
  type TextInput,
} from './texts'

const input = (segments: string[], extra: Partial<TextInput> = {}): TextInput => ({
  title: 'Moje afirmacje',
  type: 'affirmation',
  lang: 'pl',
  splitMode: 'line',
  segments,
  ...extra,
})

function attemptFor(segmentId: string, textId: string): Attempt {
  return {
    id: `a-${segmentId}`,
    segmentId,
    textId,
    sessionRunId: 'run',
    dayKey: '2026-09-25',
    timestamp: 1,
    coverage: 1,
    extra: 0,
    wrong: 0,
    accepted: true,
    firstTry: true,
    strictness: 'strict',
    engine: 'webspeech',
    durationMs: 1000,
  }
}

beforeEach(resetDb)

describe('createText', () => {
  it('stores the text, its body and ordered segments with word counts', async () => {
    const text = await createText(input(['Jestem spokojny.', 'Idę dalej z odwagą.']), 100)
    expect(text).toMatchObject({ source: 'user', archived: false, body: 'Jestem spokojny.\nIdę dalej z odwagą.', createdAt: 100 })
    const segments = await getActiveSegments(text.id)
    expect(segments.map((s) => [s.order, s.content, s.wordCount])).toEqual([
      [0, 'Jestem spokojny.', 2],
      [1, 'Idę dalej z odwagą.', 4],
    ])
  })

  it('joins sentence-mode bodies with spaces', async () => {
    const text = await createText(input(['Pierwsze zdanie tutaj.', 'Drugie zdanie.'], { splitMode: 'sentence' }))
    expect(text.body).toBe('Pierwsze zdanie tutaj. Drugie zdanie.')
  })

  it.each([
    [input(['Ok zdanie.'], { title: '  ' }), 'titleEmpty'],
    [input(['Ok zdanie.'], { title: 'x'.repeat(121) }), 'titleTooLong'],
    [input([]), 'noSegments'],
    [input(Array.from({ length: 151 }, () => 'Jedno zdanie.')), 'tooManySegments'],
    [input([Array.from({ length: 81 }, () => 'słowo').join(' ')]), 'segmentTooLong'],
    [input(['—']), 'segmentEmpty'],
  ])('rejects invalid input (%#)', async (bad, code) => {
    await expect(createText(bad)).rejects.toMatchObject({ code })
    await expect(createText(bad)).rejects.toBeInstanceOf(TextValidationError)
  })
})

describe('updateText', () => {
  it('keeps ids of unchanged segments, archives spoken edits, deletes unspoken ones', async () => {
    const text = await createText(input(['Jestem spokojny.', 'Jestem silny.', 'Jestem wdzięczny.']))
    const [calm, strong, grateful] = await getActiveSegments(text.id)
    await db.attempts.add(attemptFor(strong!.id, text.id))
    await db.textStats.put({ textId: text.id, repetitions: 7, segmentsAccepted: 21, currentDayStreak: 1, bestDayStreak: 1, perfectRuns: 0, consecutiveFirstTry: 0, bestConsecutiveFirstTry: 0, memoryRuns: 0 })

    await updateText(text.id, input(['Jestem wdzięczny.', 'Jestem spokojny.', 'Jestem odważny.']))

    const active = await getActiveSegments(text.id)
    expect(active.map((s) => s.content)).toEqual(['Jestem wdzięczny.', 'Jestem spokojny.', 'Jestem odważny.'])
    expect(active[0]!.id).toBe(grateful!.id)
    expect(active[1]!.id).toBe(calm!.id)
    expect((await db.segments.get(strong!.id))?.archived).toBe(true)
    expect(await db.segments.where('textId').equals(text.id).count()).toBe(4)
    expect((await db.textStats.get(text.id))?.repetitions).toBe(7)
    expect((await db.texts.get(text.id))?.body).toBe('Jestem wdzięczny.\nJestem spokojny.\nJestem odważny.')
  })

  it('refuses to edit builtin texts', async () => {
    await db.texts.add({ id: 'builtin:x', title: 'X', type: 'prayer', lang: 'pl', body: 'A b c.', source: 'builtin', tags: [], archived: false, splitMode: 'sentence', createdAt: 0, updatedAt: 0 })
    await expect(updateText('builtin:x', input(['A b c.']))).rejects.toMatchObject({ code: 'notEditable' })
  })
})

describe('other text operations', () => {
  it('hides and shows a text', async () => {
    const text = await createText(input(['Jestem spokojny.']))
    await setTextArchived(text.id, true)
    expect((await db.texts.get(text.id))?.archived).toBe(true)
  })

  it('copies a text as the user’s own', async () => {
    const original = await createText(input(['Jestem spokojny.', 'Idę dalej.']))
    const copy = await copyTextAsOwn(original.id, 'Kopia')
    expect(copy).toMatchObject({ title: 'Kopia', source: 'user', lang: 'pl' })
    expect((await getActiveSegments(copy.id)).map((s) => s.content)).toEqual(['Jestem spokojny.', 'Idę dalej.'])
  })

  it('deletes a user text with its segments, stats, achievements and template items but keeps history', async () => {
    const text = await createText(input(['Jestem spokojny.']))
    const [segment] = await getActiveSegments(text.id)
    await db.attempts.add(attemptFor(segment!.id, text.id))
    await db.textStats.put({ textId: text.id, repetitions: 1, segmentsAccepted: 1, currentDayStreak: 1, bestDayStreak: 1, perfectRuns: 0, consecutiveFirstTry: 1, bestConsecutiveFirstTry: 1, memoryRuns: 0 })
    await db.achievements.add({ key: `text.reps.1:${text.id}`, ruleId: 'text.reps.1', textId: text.id, tier: 'bronze', xp: 50, unlockedAt: 1 })
    await db.achievements.add({ key: 'streak.2', ruleId: 'streak.2', tier: 'bronze', xp: 50, unlockedAt: 1 })
    await db.sessionTemplates.add({ id: 't', name: 'T', pinned: false, items: [{ textId: text.id, repeat: 2 }, { textId: 'other', repeat: 1 }], createdAt: 0, updatedAt: 0, source: 'user', archived: false })

    await deleteUserText(text.id)

    expect(await db.texts.get(text.id)).toBeUndefined()
    expect(await db.segments.where('textId').equals(text.id).count()).toBe(0)
    expect(await db.textStats.get(text.id)).toBeUndefined()
    expect((await db.achievements.toCollection().primaryKeys()).sort()).toEqual(['create.1', 'streak.2'])
    expect((await db.sessionTemplates.get('t'))?.items).toEqual([{ textId: 'other', repeat: 1 }])
    expect(await db.attempts.count()).toBe(1)
  })
})
