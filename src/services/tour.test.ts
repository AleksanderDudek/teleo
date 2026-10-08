import { beforeEach, describe, expect, it } from 'vitest'
import { builtinTextId } from '@/content'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { applyContentPreferences, seedCore } from './seed'
import { updateAppSettings } from './settings'
import { firstTextForNeed } from './tour'

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', grammaticalForm: 'n' })
  await seedCore()
})

describe('firstTextForNeed', () => {
  it('picks the first visible text of the language that has the need, as the library lists it', async () => {
    expect(await firstTextForNeed('peace', 'pl')).toBe(builtinTextId('pl.poranek'))
    expect(await firstTextForNeed('peace', 'en')).toBe(builtinTextId('en.morning'))
  })

  it('finds nothing among hidden texts', async () => {
    await applyContentPreferences('pl', 'own')
    expect(await firstTextForNeed('peace', 'pl')).toBeUndefined()
    expect(await db.texts.count()).toBeGreaterThan(0)
  })
})
