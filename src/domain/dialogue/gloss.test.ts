import { describe, expect, it } from 'vitest'
import { GlossError, glossIds, linkPairs, parseGloss, roleOf } from './gloss'

describe('parseGloss', () => {
  it('reads a line without links as one plain part', () => {
    expect(parseGloss('Good morning!')).toEqual({ plain: 'Good morning!', parts: [{ text: 'Good morning!', ids: [] }] })
  })

  it('splits linked words from the text around them', () => {
    const gloss = parseGloss('{I|s1} {am|v1} {tired|a1}.')
    expect(gloss.plain).toBe('I am tired.')
    expect(gloss.parts).toEqual([
      { text: 'I', ids: ['s1'], role: 'subject' },
      { text: ' ', ids: [] },
      { text: 'am', ids: ['v1'], role: 'predicate' },
      { text: ' ', ids: [] },
      { text: 'tired', ids: ['a1'], role: 'adjective' },
      { text: '.', ids: [] },
    ])
  })

  it('links several words at once and keeps the punctuation outside', () => {
    const gloss = parseGloss('{I|s1}{’d like|v1} a {large|a1} {coffee|o1}, please.')
    expect(gloss.plain).toBe('I’d like a large coffee, please.')
    expect(gloss.parts.map((p) => p.text)).toEqual(['I', '’d like', ' a ', 'large', ' ', 'coffee', ', please.'])
  })

  it('lets one word carry several links; the first one gives its role', () => {
    const [part] = parseGloss('{Jestem|v1, s1} zmęczony.').parts
    expect(part).toEqual({ text: 'Jestem', ids: ['v1', 's1'], role: 'predicate' })
  })

  it('reads the roles from the id letter', () => {
    expect(roleOf('s2')).toBe('subject')
    expect(roleOf('v1')).toBe('predicate')
    expect(roleOf('a3')).toBe('adjective')
    expect(roleOf('o1')).toBe('object')
  })

  it('collects every id of a line', () => {
    expect([...glossIds(parseGloss('{Poproszę|v1,s1} {dużą|a1} {kawę|o1}.'))].sort()).toEqual(['a1', 'o1', 's1', 'v1'])
  })

  it.each([
    ['{I|x1} am', 'unknown id'],
    ['{I} am', 'no id'],
    ['{I|s1 am', 'not closed'],
    ['I|s1} am', 'stray'],
    ['{|s1} am', 'empty'],
    ['{a {b|s1}|s2}', 'nested'],
    ['{I|s1,} am', 'unknown id'],
  ])('rejects malformed markup: %s', (markup, message) => {
    expect(() => parseGloss(markup)).toThrow(GlossError)
    expect(() => parseGloss(markup)).toThrow(message)
  })
})

describe('linkPairs', () => {
  it('pairs the linked words of two languages, in the order of the first line', () => {
    const en = parseGloss('{I|s1}{’d like|v1} a {large|a1} {coffee|o1}, please.')
    const pl = parseGloss('{Poproszę|v1,s1} {dużą|a1} {kawę|o1}.')
    expect(linkPairs(en, pl)).toEqual([
      { id: 's1', role: 'subject', from: 'I', to: 'Poproszę' },
      { id: 'v1', role: 'predicate', from: '’d like', to: 'Poproszę' },
      { id: 'a1', role: 'adjective', from: 'large', to: 'dużą' },
      { id: 'o1', role: 'object', from: 'coffee', to: 'kawę' },
    ])
  })

  it('joins words of one link with an ellipsis when something stands between them', () => {
    const en = parseGloss('{Do|v1} {you|s1} {work|v1} nearby?')
    const pl = parseGloss('{Pracujesz|v1,s1} w pobliżu?')
    expect(linkPairs(en, pl)).toEqual([
      { id: 'v1', role: 'predicate', from: 'Do … work', to: 'Pracujesz' },
      { id: 's1', role: 'subject', from: 'you', to: 'Pracujesz' },
    ])
  })

  it('has no pairs for a line without links', () => {
    expect(linkPairs(parseGloss('See you!'), parseGloss('Na razie!'))).toEqual([])
  })
})
