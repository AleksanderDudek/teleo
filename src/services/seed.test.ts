import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId, loadBuiltinTexts } from '@/content'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { applyContentPreferences, applyGrammaticalForm, applyLanguage, defaultPinnedSessionKey, SEED_VERSION, seedBuiltins } from './seed'
import { readSettings, updateAppSettings, updateMeta } from './settings'
import { getActiveSegments } from './texts'

const isLibraryPrayer = (key: string | undefined) => key?.includes('.lovy-') ?? false
/** Visible core builtins (the prayer library is checked apart: 266 keys would drown the lists). */
const visibleTexts = async () =>
  (await db.texts.toArray())
    .filter((t) => !t.archived && !isLibraryPrayer(t.builtinKey))
    .map((t) => t.builtinKey)
    .sort()
const visibleLibraryPrayers = async () =>
  (await db.texts.toArray()).filter((t) => !t.archived && isLibraryPrayer(t.builtinKey)).length
const LIBRARY_PRAYERS = (await loadBuiltinTexts()).filter((def) => isLibraryPrayer(def.key)).length

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', grammaticalForm: 'n' })
})

describe('seedBuiltins', () => {
  it('inserts all builtin texts and sessions once', async () => {
    await seedBuiltins(10)
    expect(await db.texts.count()).toBe((await loadBuiltinTexts()).length)
    expect(await db.sessionTemplates.count()).toBe(8)
    expect((await readSettings()).meta.seedVersion).toBe(SEED_VERSION)
    const segmentsBefore = await db.segments.count()
    await seedBuiltins(20)
    expect(await db.segments.count()).toBe(segmentsBefore)
    expect((await db.texts.get(builtinTextId('pl.ojcze-nasz')))?.updatedAt).toBe(10)
  })

  it('shows builtins of both languages together (both focus) and pins the rosary for Polish', async () => {
    await seedBuiltins()
    expect(await visibleTexts()).toEqual([
      'en.glory-be',
      'en.hail-mary',
      'en.lords-prayer',
      'en.morning',
      'en.psalm-23',
      'en.psalm-91',
      'en.through-christ',
      'en.verses-of-strength',
      'pl.aniele-bozy',
      'pl.chwala-ojcu',
      'pl.ojcze-nasz',
      'pl.poranek',
      'pl.przez-jezusa-chrystusa',
      'pl.zdrowas-maryjo',
    ])
    const rosary = await db.sessionTemplates.get(builtinSessionId('pl.dziesiatka-rozanca'))
    expect(rosary).toMatchObject({ pinned: true, archived: false, source: 'builtin' })
    expect(rosary?.items).toEqual([
      { textId: builtinTextId('pl.ojcze-nasz'), repeat: 1 },
      { textId: builtinTextId('pl.zdrowas-maryjo'), repeat: 10 },
      { textId: builtinTextId('pl.chwala-ojcu'), repeat: 1 },
    ])
  })

  it('seeds the prayer library with what each text is for, visible under the content focus', async () => {
    await seedBuiltins()
    expect(LIBRARY_PRAYERS).toBeGreaterThan(200)
    expect(await visibleLibraryPrayers()).toBe(LIBRARY_PRAYERS)
    expect((await db.texts.get(builtinTextId('en.lovy-sleep-nightmares')))?.needs).toEqual(['sleep', 'warfare'])
    expect((await db.texts.get(builtinTextId('pl.lovy-sleep-nightmares')))?.needs).toEqual(['sleep', 'warfare'])
    expect((await db.texts.get(builtinTextId('pl.ojcze-nasz')))?.needs).toEqual(['traditional'])
  })

  it('gives the texts of an older seed their needs when content is re-seeded', async () => {
    await seedBuiltins()
    await db.texts.update(builtinTextId('en.psalm-91'), { needs: undefined })
    await updateMeta({ seedVersion: 2 })
    await seedBuiltins()
    expect((await db.texts.get(builtinTextId('en.psalm-91')))?.needs).toEqual(['scripture', 'protection'])
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

  it('affirmations focus shows affirmation texts in both languages and pins the English morning set', async () => {
    await applyContentPreferences('en', 'affirmations')
    expect(await visibleTexts()).toEqual(['en.morning', 'en.through-christ', 'pl.poranek', 'pl.przez-jezusa-chrystusa'])
    const sessions = (await db.sessionTemplates.toArray()).filter((s) => !s.archived)
    expect(sessions.map((s) => [s.builtinKey, s.pinned])).toEqual([
      ['en.morning-affirmations', true],
      ['en.through-christ-session', false],
      ['pl.poranne-afirmacje', false],
      ['pl.przez-jezusa-chrystusa-sesja', false],
    ])
    expect(await visibleLibraryPrayers()).toBe(0)
  })

  it('prayers focus shows prayer texts in both languages', async () => {
    await applyContentPreferences('pl', 'prayers')
    expect(await visibleTexts()).toEqual([
      'en.glory-be',
      'en.hail-mary',
      'en.lords-prayer',
      'en.psalm-23',
      'en.psalm-91',
      'en.verses-of-strength',
      'pl.aniele-bozy',
      'pl.chwala-ojcu',
      'pl.ojcze-nasz',
      'pl.zdrowas-maryjo',
    ])
    expect(await visibleLibraryPrayers()).toBe(LIBRARY_PRAYERS)
  })

  it('own texts hides every builtin', async () => {
    await applyContentPreferences('pl', 'own')
    expect(await visibleTexts()).toEqual([])
    expect(await visibleLibraryPrayers()).toBe(0)
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

  it('speaks the Polish prayer library in the chosen form too', async () => {
    const def = (await loadBuiltinTexts()).find((d) => d.key.startsWith('pl.lovy-') && d.variants)
    const variants = def?.variants
    if (!def || !variants) throw new Error('no gendered library prayer')
    const index = variants.m.findIndex((sentence, i) => sentence !== variants.f[i])
    await seedBuiltins()
    const id = builtinTextId(def.key)
    expect((await getActiveSegments(id))[index]?.content).toBe(variants.n[index])
    await applyGrammaticalForm('f')
    expect((await getActiveSegments(id))[index]?.content).toBe(variants.f[index])
  })
})

describe('applyLanguage', () => {
  it('pins the default session of the new language when none of its sessions is pinned', async () => {
    await updateAppSettings({ uiLang: 'pl', contentFocus: 'both' })
    await seedBuiltins()
    expect((await db.sessionTemplates.get(builtinSessionId('pl.dziesiatka-rozanca')))?.pinned).toBe(true)

    await applyLanguage('en', 'both')
    expect((await db.sessionTemplates.get(builtinSessionId('en.morning-affirmations')))?.pinned).toBe(true)
    // The Polish pin stays for when the language is switched back.
    expect((await db.sessionTemplates.get(builtinSessionId('pl.dziesiatka-rozanca')))?.pinned).toBe(true)
  })

  it('leaves the pins alone when the language already has a pinned session', async () => {
    await updateAppSettings({ uiLang: 'pl', contentFocus: 'both' })
    await seedBuiltins()
    await db.sessionTemplates.update(builtinSessionId('en.decade-of-the-rosary'), { pinned: true })
    await applyLanguage('en', 'both')
    expect((await db.sessionTemplates.get(builtinSessionId('en.morning-affirmations')))?.pinned).toBe(false)
  })
})
