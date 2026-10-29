import { describe, expect, it } from 'vitest'
import { indexForSearch, rankBySearch, searchScore, searchTerms } from './librarySearch'

const doc = (title: string, { labels = [] as string[], tags = [] as string[], body = '' } = {}) =>
  indexForSearch({ title, labels, tags, body })

describe('searchTerms', () => {
  it('folds case and diacritics and splits on anything that is not a letter', () => {
    expect(searchTerms('  Lęk,  NIEPOKÓJ!  ')).toEqual(['lek', 'niepokoj'])
    expect(searchTerms('spirit-spouse')).toEqual(['spirit', 'spouse'])
  })

  it('drops repeats and empty queries', () => {
    expect(searchTerms('fear fear')).toEqual(['fear'])
    expect(searchTerms('  ,. ')).toEqual([])
  })
})

describe('searchScore', () => {
  it('needs every word, in any order', () => {
    const index = doc('Breaking Spirit Spouse Bondage')
    expect(searchScore(index, searchTerms('spouse spirit'))).toBeGreaterThan(0)
    expect(searchScore(index, searchTerms('spirit money'))).toBe(0)
  })

  it('matches the start of a word, not its middle', () => {
    expect(searchScore(doc('Against Witchcraft'), searchTerms('witch'))).toBeGreaterThan(0)
    expect(searchScore(doc('Against Witchcraft'), searchTerms('craft'))).toBe(0)
  })

  it('finds an inflected Polish word from another form of it', () => {
    expect(searchScore(doc('Wolność od długów'), searchTerms('długi'))).toBeGreaterThan(0)
    expect(searchScore(doc('Za moje małżeństwo'), searchTerms('małżeństwo'))).toBeGreaterThan(0)
    expect(searchScore(doc('O zdrowie dzieci'), searchTerms('dziecko'))).toBeGreaterThan(0)
  })

  it('does not cut short words down to unrelated ones', () => {
    // "dzieci" may reach "dziec…" but never "dzie…" (dzień, dziedzictwo).
    expect(searchScore(doc('Na nowy dzień'), searchTerms('dzieci'))).toBe(0)
    expect(searchScore(doc('For peace'), searchTerms('pea'))).toBeGreaterThan(0)
  })

  it('searches what a text is prayed for, its tags and its words', () => {
    expect(searchScore(doc('A Night Prayer', { labels: ['Sleep & nightmares'] }), searchTerms('nightmares'))).toBeGreaterThan(0)
    expect(searchScore(doc('Any', { tags: ['Demony burzące'] }), searchTerms('demony'))).toBeGreaterThan(0)
    expect(searchScore(doc('Any', { body: 'I break every chain of debt.' }), searchTerms('debt'))).toBeGreaterThan(0)
  })

  it('ranks a title above a need, a need above a tag, a tag above the words', () => {
    const terms = searchTerms('debt')
    const title = searchScore(doc('Freedom from Debt'), terms)
    const label = searchScore(doc('Any', { labels: ['Money & debt'] }), terms)
    const tag = searchScore(doc('Any', { tags: ['debt'] }), terms)
    const body = searchScore(doc('Any', { body: 'debt' }), terms)
    expect(title).toBeGreaterThan(label)
    expect(label).toBeGreaterThan(tag)
    expect(tag).toBeGreaterThan(body)
    expect(body).toBeGreaterThan(0)
  })

  it('scores a text that says a word often above one that says it once', () => {
    const terms = searchTerms('witchcraft')
    expect(searchScore(doc('Any', { body: 'witchcraft. witchcraft. witchcraft.' }), terms)).toBeGreaterThan(
      searchScore(doc('Any', { body: 'witchcraft.' }), terms),
    )
  })

  it('lets everything through an empty query', () => {
    expect(searchScore(doc('Any'), [])).toBeGreaterThan(0)
  })
})

describe('rankBySearch', () => {
  it('keeps matches only, best first, and the given order among equals', () => {
    const items = [
      { id: 'mentions', index: doc('Against Poverty', { body: 'debt' }) },
      { id: 'other', index: doc('For Peace') },
      { id: 'dedicated', index: doc('Freedom from Debt', { body: 'debt debt' }) },
      { id: 'mentions-too', index: doc('For Overflow', { body: 'debt' }) },
    ]
    expect(rankBySearch(items, searchTerms('debt'), (item) => item.index).map((item) => item.id)).toEqual([
      'dedicated',
      'mentions',
      'mentions-too',
    ])
  })

  it('returns the list as it was for an empty query', () => {
    const items = [{ index: doc('B') }, { index: doc('A') }]
    expect(rankBySearch(items, [], (item) => item.index)).toEqual(items)
  })
})
