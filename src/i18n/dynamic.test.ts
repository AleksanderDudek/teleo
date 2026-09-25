import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_RULES } from '@/domain/gamification'
import en from './en.json'
import pl from './pl.json'

const lookup = (dict: unknown, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict)

describe('runtime translation keys', () => {
  it('every achievement rule has a name and description in both languages', () => {
    const missing = ACHIEVEMENT_RULES.flatMap((rule) =>
      [en, pl].flatMap((dict, i) =>
        ['name', 'desc'].filter((field) => typeof lookup(dict, `achievements.${rule.id}.${field}`) !== 'string').map((f) => `${i ? 'pl' : 'en'}:${rule.id}.${f}`),
      ),
    )
    expect(missing).toEqual([])
  })

  it('names levels 1–20 in both languages', () => {
    for (const dict of [en, pl]) {
      for (let level = 1; level <= 20; level++) expect(typeof lookup(dict, `levelNames.${level}`)).toBe('string')
    }
  })
})
