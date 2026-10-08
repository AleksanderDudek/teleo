import { describe, expect, it } from 'vitest'
import {
  areaOf,
  countNeeds,
  isNeedArea,
  isNeedId,
  mainNeed,
  matchesNeed,
  NEED_AREAS,
  NEED_IDS,
  NEEDS_BY_AREA,
  needsOf,
  parseNeedFilter,
} from './needs'

describe('need taxonomy', () => {
  it('puts every need in exactly one area, with unique ids', () => {
    const all = NEED_AREAS.flatMap((area) => NEEDS_BY_AREA[area])
    expect(new Set(all).size).toBe(all.length)
    expect([...NEED_IDS].sort()).toEqual([...all].sort())
    for (const area of NEED_AREAS) for (const need of NEEDS_BY_AREA[area]) expect(areaOf(need)).toBe(area)
  })

  it('recognises its own ids only', () => {
    expect(isNeedId('healing')).toBe(true)
    expect(isNeedId('wealth')).toBe(false)
    expect(isNeedId(3)).toBe(false)
    expect(isNeedArea('health')).toBe(true)
    expect(isNeedArea('healing')).toBe(false)
  })
})

describe('needsOf', () => {
  it('keeps known needs in order, once, and drops unknown ones (newer backups)', () => {
    expect(needsOf({ needs: ['sleep', 'future-need', 'warfare', 'sleep'] })).toEqual(['sleep', 'warfare'])
    expect(needsOf({})).toEqual([])
  })

  it('names the first known need as the main one', () => {
    expect(mainNeed({ needs: ['unknown', 'marriage', 'newStart'] })).toBe('marriage')
    expect(mainNeed({ needs: [] })).toBeUndefined()
  })
})

describe('matchesNeed', () => {
  const text = { needs: ['healing', 'bloodline'] }

  it('matches everything without a filter', () => {
    expect(matchesNeed({}, {})).toBe(true)
    expect(matchesNeed(text, {})).toBe(true)
  })

  it('matches a need anywhere in the list, not only the main one', () => {
    expect(matchesNeed(text, { area: 'deliverance', need: 'bloodline' })).toBe(true)
    expect(matchesNeed(text, { area: 'health', need: 'sleep' })).toBe(false)
  })

  it('matches an area through any of its needs', () => {
    expect(matchesNeed(text, { area: 'health' })).toBe(true)
    expect(matchesNeed(text, { area: 'deliverance' })).toBe(true)
    expect(matchesNeed(text, { area: 'family' })).toBe(false)
    expect(matchesNeed({}, { area: 'family' })).toBe(false)
  })
})

describe('countNeeds', () => {
  it('counts a text once per area and once per need', () => {
    const counts = countNeeds([
      { needs: ['healing', 'strength'] },
      { needs: ['healing', 'bloodline'] },
      { needs: ['nonsense'] },
      {},
    ])
    expect(counts.areas.get('health')).toBe(2)
    expect(counts.areas.get('deliverance')).toBe(1)
    expect(counts.areas.has('family')).toBe(false)
    expect(counts.needs.get('healing')).toBe(2)
    expect(counts.needs.get('strength')).toBe(1)
  })
})

describe('parseNeedFilter', () => {
  it('reads an area and a need of that area', () => {
    expect(parseNeedFilter('health', 'sleep')).toEqual({ area: 'health', need: 'sleep' })
    expect(parseNeedFilter('health', null)).toEqual({ area: 'health' })
  })

  it('takes the area from the need, whatever the link said', () => {
    expect(parseNeedFilter(null, 'sleep')).toEqual({ area: 'health', need: 'sleep' })
    expect(parseNeedFilter('family', 'sleep')).toEqual({ area: 'health', need: 'sleep' })
  })

  it('ignores what it does not know', () => {
    expect(parseNeedFilter('nowhere', 'nothing')).toEqual({})
    expect(parseNeedFilter('health', 'nothing')).toEqual({ area: 'health' })
  })
})
