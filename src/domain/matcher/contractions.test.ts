import { describe, expect, it } from 'vitest'
import { expandContractions, joinSplitCompounds } from './contractions'
import type { Token } from './types'

/** One token per space-separated word, each from its own raw word. */
const tokens = (text: string): Token[] =>
  text.split(' ').map((word, index) => ({ text: word, rawStart: index, rawEnd: index }))
const texts = (list: readonly Token[]) => list.map((token) => token.text).join(' ')

describe('expandContractions', () => {
  it.each([
    ["i'm", 'i am'],
    ["you're", 'you are'],
    ["we're", 'we are'],
    ["they're", 'they are'],
    ["i've", 'i have'],
    ["we'll", 'we will'],
    ["you'd", 'you would'],
    ["let's", 'let us'],
    ["can't", 'cannot'],
    ["won't", 'will not'],
    ["shan't", 'shall not'],
    ["ain't", 'am not'],
    ["don't", 'do not'],
    ["isn't", 'is not'],
    ["doesn't", 'does not'],
    ["couldn't", 'could not'],
  ])('%s → %s', (contraction, expanded) => {
    expect(texts(expandContractions(tokens(contraction)))).toBe(expanded)
  })

  it.each(['it', 'that', 'what', 'there', 'here', 'he', 'she', 'who', 'where', 'how'])(
    "%s's → … is",
    (host) => {
      expect(texts(expandContractions(tokens(`${host}'s`)))).toBe(`${host} is`)
    },
  )

  it("keeps any other 's as one possessive word", () => {
    expect(texts(expandContractions(tokens("god's mary's")))).toBe("god's mary's")
  })

  it('leaves words without contractions untouched', () => {
    expect(texts(expandContractions(tokens('i am enough')))).toBe('i am enough')
  })

  it('gives the expanded words the raw range of the contraction', () => {
    expect(expandContractions(tokens("i'm here"))).toEqual([
      { text: 'i', rawStart: 0, rawEnd: 0 },
      { text: 'am', rawStart: 0, rawEnd: 0 },
      { text: 'here', rawStart: 1, rawEnd: 1 },
    ])
  })

  it('sees through quotation apostrophes around a contraction', () => {
    expect(texts(expandContractions(tokens("'i'm enough'")))).toBe("i am enough'")
  })
})

describe('joinSplitCompounds', () => {
  it('joins "can not" and "for ever" into one token spanning both raw words', () => {
    expect(joinSplitCompounds(tokens('i can not stop for ever'))).toEqual([
      { text: 'i', rawStart: 0, rawEnd: 0 },
      { text: 'cannot', rawStart: 1, rawEnd: 2 },
      { text: 'stop', rawStart: 3, rawEnd: 3 },
      { text: 'forever', rawStart: 4, rawEnd: 5 },
    ])
  })

  it('leaves other word pairs alone', () => {
    expect(texts(joinSplitCompounds(tokens('i can do it for today')))).toBe('i can do it for today')
  })

  it('joins only the first pair of an overlapping sequence', () => {
    expect(texts(joinSplitCompounds(tokens('for for ever and ever')))).toBe('for forever and ever')
    expect(texts(joinSplitCompounds(tokens('can not not')))).toBe('cannot not')
  })
})
