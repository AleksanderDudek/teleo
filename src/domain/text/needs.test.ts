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
  needRank,
  needsOf,
  parseNeedFilter,
  relatedTexts,
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

describe('needRank', () => {
  it('puts texts mainly for the chosen need (or area) before those that only touch it', () => {
    const main = { needs: ['peace', 'anxiety'] }
    const touches = { needs: ['warfare', 'peace'] }
    expect(needRank(main, { area: 'emotions', need: 'peace' })).toBe(0)
    expect(needRank(touches, { area: 'emotions', need: 'peace' })).toBe(1)
    expect(needRank(main, { area: 'emotions' })).toBe(0)
    expect(needRank(touches, { area: 'emotions' })).toBe(1)
    expect(needRank(touches, {})).toBe(0)
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

describe('relatedTexts', () => {
  const text = (id: string, needs: string[], title = id) => ({ id, title, needs })
  const self = text('self', ['marriage', 'spiritSpouse'])
  const all = [
    self,
    text('marriage-b', ['marriage', 'home'], 'B marriage'),
    text('marriage-a', ['marriage'], 'A marriage'),
    text('marriage-touch', ['home', 'marriage'], 'C marriage'),
    text('spirit-spouse', ['spouse', 'spiritSpouse'], 'Spirit spouse'),
    text('soul-ties', ['spiritSpouse', 'forgiveness'], 'Soul ties'),
    text('unrelated', ['sleep']),
  ]

  it('takes turns over the needs of the text, main need first, each best first', () => {
    // For each need: texts mainly for it before texts that only touch it, then by title.
    expect(relatedTexts(self, all).map((other) => other.id)).toEqual(['marriage-a', 'soul-ties', 'marriage-b', 'spirit-spouse'])
  })

  it('fills the turns of a need that has run out with the others', () => {
    expect(relatedTexts(self, all, 6).map((other) => other.id)).toEqual([
      'marriage-a',
      'soul-ties',
      'marriage-b',
      'spirit-spouse',
      'marriage-touch',
    ])
  })

  it('never lists the text itself, a text twice, or past the limit', () => {
    const both = text('both', ['spiritSpouse', 'marriage'], 'Both')
    const ids = relatedTexts(self, [...all, both], 3).map((other) => other.id)
    expect(ids).toEqual(['marriage-a', 'both', 'marriage-b'])
    expect(relatedTexts(self, all, 2)).toHaveLength(2)
  })

  it('has nothing for a text without needs', () => {
    expect(relatedTexts(text('mine', []), all)).toEqual([])
  })
})
