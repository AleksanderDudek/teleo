import { beforeEach, describe, expect, it } from 'vitest'
import { builtinTextId } from '@/content'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { applyContentPreferences, seedCore, seedLibrary } from './seed'
import { updateAppSettings } from './settings'
import { tourTextFor } from './tour'

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', grammaticalForm: 'n' })
  await seedCore()
})

describe('tourTextFor', () => {
  it('opens the core text mainly for the need while the library is still on its way', async () => {
    expect(await tourTextFor('peace', 'pl')).toBe(builtinTextId('pl.poranek'))
    expect(await tourTextFor('peace', 'en')).toBe(builtinTextId('en.morning'))
  })

  it('prefers the story prayer once the library is in', async () => {
    await seedLibrary()
    expect(await tourTextFor('peace', 'pl')).toBe(builtinTextId('pl.lovy-peace'))
    expect(await tourTextFor('peace', 'en')).toBe(builtinTextId('en.lovy-peace'))
  })

  it('finds nothing among hidden texts', async () => {
    await applyContentPreferences('pl', 'own')
    expect(await tourTextFor('peace', 'pl')).toBeUndefined()
    expect(await db.texts.count()).toBeGreaterThan(0)
  })
})
