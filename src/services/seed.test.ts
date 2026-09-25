import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId } from '@/content'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { applyContentPreferences, applyGrammaticalForm, defaultPinnedSessionKey, SEED_VERSION, seedBuiltins } from './seed'
import { readSettings, updateAppSettings, updateMeta } from './settings'
import { getActiveSegments } from './texts'

const visibleTexts = async () =>
  (await db.texts.toArray()).filter((t) => !t.archived).map((t) => t.builtinKey).sort()

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', grammaticalForm: 'n' })
})

describe('seedBuiltins', () => {
  it('inserts all builtin texts and sessions once', async () => {
    await seedBuiltins(10)
    expect(await db.texts.count()).toBe(10)
    expect(await db.sessionTemplates.count()).toBe(4)
    expect((await readSettings()).meta.seedVersion).toBe(SEED_VERSION)
    const segmentsBefore = await db.segments.count()
    await seedBuiltins(20)
    expect(await db.segments.count()).toBe(segmentsBefore)
    expect((await db.texts.get(builtinTextId('pl.ojcze-nasz')))?.updatedAt).toBe(10)
  })

  it('shows builtins in the interface language and pins the rosary for Polish', async () => {
    await seedBuiltins()
    expect(await visibleTexts()).toEqual(['pl.aniele-bozy', 'pl.chwala-ojcu', 'pl.ojcze-nasz', 'pl.poranek', 'pl.zdrowas-maryjo'])
    const rosary = await db.sessionTemplates.get(builtinSessionId('pl.dziesiatka-rozanca'))
    expect(rosary).toMatchObject({ pinned: true, archived: false, source: 'builtin' })
    expect(rosary?.items).toEqual([
      { textId: builtinTextId('pl.ojcze-nasz'), repeat: 1 },
      { textId: builtinTextId('pl.zdrowas-maryjo'), repeat: 10 },
      { textId: builtinTextId('pl.chwala-ojcu'), repeat: 1 },
    ])
  })

  it('uses the neutral form of the Polish affirmations by default', async () => {
    await seedBuiltins()
    const segments = await getActiveSegments(builtinTextId('pl.poranek'))
    expect(segments).toHaveLength(10)
    expect(segments[0]?.content).toBe('Zachowuję spokój i skupienie.')
  })

  it('keeps user choices (hidden, pinned) when content is re-seeded', async () => {
    await seedBuiltins()
    await db.texts.update(builtinTextId('pl.aniele-bozy'), { archived: true })
    await db.sessionTemplates.update(builtinSessionId('pl.dziesiatka-rozanca'), { pinned: false })
    await updateMeta({ seedVersion: 0 })
    await seedBuiltins()
    expect((await db.texts.get(builtinTextId('pl.aniele-bozy')))?.archived).toBe(true)
    expect((await db.sessionTemplates.get(builtinSessionId('pl.dziesiatka-rozanca')))?.pinned).toBe(false)
  })
})

describe('applyContentPreferences', () => {
  beforeEach(() => seedBuiltins())

  it('English + affirmations shows only the English morning set and pins it', async () => {
    await applyContentPreferences('en', 'affirmations')
    expect(await visibleTexts()).toEqual(['en.morning'])
    const sessions = (await db.sessionTemplates.toArray()).filter((s) => !s.archived)
    expect(sessions.map((s) => [s.builtinKey, s.pinned])).toEqual([['en.morning-affirmations', true]])
  })

  it('Polish prayers hides affirmations', async () => {
    await applyContentPreferences('pl', 'prayers')
    expect(await visibleTexts()).toEqual(['pl.aniele-bozy', 'pl.chwala-ojcu', 'pl.ojcze-nasz', 'pl.zdrowas-maryjo'])
  })

  it('own texts hides every builtin', async () => {
    await applyContentPreferences('pl', 'own')
    expect(await visibleTexts()).toEqual([])
    expect(defaultPinnedSessionKey('pl', 'own')).toBeNull()
  })

  it('picks the default pinned session per language and focus', () => {
    expect(defaultPinnedSessionKey('pl', 'both')).toBe('pl.dziesiatka-rozanca')
    expect(defaultPinnedSessionKey('pl', 'affirmations')).toBe('pl.poranne-afirmacje')
    expect(defaultPinnedSessionKey('en', 'both')).toBe('en.morning-affirmations')
    expect(defaultPinnedSessionKey('en', 'prayers')).toBe('en.decade-of-the-rosary')
  })
})

describe('applyGrammaticalForm', () => {
  it('switches gendered sentences and keeps the ids of neutral ones', async () => {
    await seedBuiltins()
    const id = builtinTextId('pl.poranek')
    const before = await getActiveSegments(id)
    await applyGrammaticalForm('f')
    const after = await getActiveSegments(id)
    expect(after[0]?.content).toBe('Jestem spokojna i skupiona.')
    expect(after[5]?.content).toBe('Jestem wdzięczna za to, co mam.')
    const kept = after.filter((segment, i) => segment.id === before[i]?.id)
    expect(kept).toHaveLength(8)
    expect((await db.texts.get(id))?.body.split('\n')[0]).toBe('Jestem spokojna i skupiona.')
  })
})
