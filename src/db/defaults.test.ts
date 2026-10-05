import { describe, expect, it } from 'vitest'
import { appSettingsFrom, DEFAULT_SETTINGS } from './defaults'

describe('appSettingsFrom', () => {
  it('fills the fields a row from an older version lacks', () => {
    expect(appSettingsFrom({ uiLang: 'en' })).toEqual({ ...DEFAULT_SETTINGS, uiLang: 'en' })
  })

  it('turns the single reminder hour of v1.x into the list, and drops the old field', () => {
    const app = appSettingsFrom({ reminderTime: '21:30' })
    expect(app.reminderTimes).toEqual(['21:30'])
    expect(app).not.toHaveProperty('reminderTime')
  })

  it('keeps a stored list over the old field, cleaned up', () => {
    expect(appSettingsFrom({ reminderTime: '21:30', reminderTimes: ['13:00', 'bad', '13:00', '07:00'] }).reminderTimes).toEqual(['13:00', '07:00'])
  })

  it('falls back to the default hours when nothing stored is valid', () => {
    expect(appSettingsFrom({ reminderTimes: ['nope'] }).reminderTimes).toEqual(['07:00', '13:00', '21:00'])
    expect(appSettingsFrom({ reminderTime: 'nope' }).reminderTimes).toEqual(['07:00', '13:00', '21:00'])
  })

  it('never hands out the shared default list', () => {
    const app = appSettingsFrom({})
    app.reminderTimes.push('23:00')
    expect(DEFAULT_SETTINGS.reminderTimes).toEqual(['07:00', '13:00', '21:00'])
  })
})
