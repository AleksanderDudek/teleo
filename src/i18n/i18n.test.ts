import { describe, expect, it } from 'vitest'
import en from './en.json'
import pl from './pl.json'

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatten(value: unknown, prefix = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    )
  }
  return [prefix]
}

const baseKeys = (keys: string[]) => new Set(keys.map((k) => k.replace(PLURAL_SUFFIX, '')))

function pluralGroups(keys: string[]): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>()
  for (const key of keys) {
    const match = PLURAL_SUFFIX.exec(key)
    if (!match?.[1]) continue
    const base = key.replace(PLURAL_SUFFIX, '')
    groups.set(base, (groups.get(base) ?? new Set()).add(match[1]))
  }
  return groups
}

describe('translations', () => {
  const enKeys = flatten(en)
  const plKeys = flatten(pl)

  it('PL and EN define the same keys (ignoring plural forms)', () => {
    const enBase = baseKeys(enKeys)
    const plBase = baseKeys(plKeys)
    expect([...plBase].filter((k) => !enBase.has(k))).toEqual([])
    expect([...enBase].filter((k) => !plBase.has(k))).toEqual([])
  })

  it('EN plurals define one + other', () => {
    for (const [base, forms] of pluralGroups(enKeys)) {
      expect([base, [...forms].sort()]).toEqual([base, ['one', 'other']])
    }
  })

  it('PL plurals define one + few + many + other', () => {
    for (const [base, forms] of pluralGroups(plKeys)) {
      expect([base, [...forms].sort()]).toEqual([base, ['few', 'many', 'one', 'other']])
    }
  })

  it('has no empty strings', () => {
    const empty = (obj: unknown, keys: string[]) =>
      keys.filter((k) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], obj) === '')
    expect(empty(en, enKeys)).toEqual([])
    expect(empty(pl, plKeys)).toEqual([])
  })
})
