import { describe, expect, it } from 'vitest'
import { textRows, withTextRows } from '@/test/textRows'
import { renamedKey, withRenamedKeys } from './renamed'
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

describe('renamedKey', () => {
  it('moves the library prayers to their new keys, in a builtin key, a text id and an achievement key', () => {
    expect(renamedKey('en.lovy-peace')).toBe('en.life-peace')
    expect(renamedKey('builtin:pl.lovy-sleep-nightmares')).toBe('builtin:pl.life-sleep-nightmares')
    expect(renamedKey('text.perfect:builtin:en.lovy-peace')).toBe('text.perfect:builtin:en.life-peace')
  })

  it('leaves every other key alone', () => {
    for (const key of ['builtin:en.stronghold-fears', 'builtin:pl.ojcze-nasz', 'own-text', 'streak.7', 'bible:kjv.GEN.0']) {
      expect(renamedKey(key)).toBe(key)
    }
  })
})

describe('withRenamedKeys', () => {
  /** One library prayer said, kept in a template and a task, with a per-text achievement and its points. */
  const said = (key: string): BackupData => {
    const rows = textRows(`builtin:${key}`, 'builtin', 'en')
    const template = { id: 'mine', name: 'Mine', pinned: false, items: [{ textId: rows.text.id, repeat: 2 }], createdAt: 1, updatedAt: 1, source: 'user' as const, archived: false }
    const task = { id: 'task1', textId: rows.text.id, timesPerDay: 3, startDay: '2026-10-05', endDay: '2026-10-18', createdAt: 1, archived: false }
    const award = { ...rows.xp, reason: 'achievement' as const, refId: rows.achievement.key }
    return withTextRows({ ...empty(), sessionTemplates: [template], tasks: [task] }, { ...rows, text: { ...rows.text, builtinKey: key }, xp: award }, textRows('own', 'user'))
  }

  it('renames a library prayer wherever its id is kept: rows, plans, templates, tasks, achievements, points', () => {
    const renamed = withRenamedKeys(said('en.lovy-peace'))
    expect(renamed).toEqual(said('en.life-peace'))
    expect(JSON.stringify(renamed)).not.toContain('lovy')
  })

  it('returns the same data when nothing is to be renamed', () => {
    const data = said('en.stronghold-fears')
    expect(withRenamedKeys(data)).toBe(data)
  })
})
