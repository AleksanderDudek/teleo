import { describe, expect, it } from 'vitest'
import type { Lang } from '@/domain/types'
import { normalizeNumbers } from './numbers'
import type { Token } from './types'

/** One token per space-separated word, each from its own raw word. */
const tokens = (text: string): Token[] =>
  text.split(' ').map((word, index) => ({ text: word, rawStart: index, rawEnd: index }))
const digits = (text: string, lang: Lang) =>
  normalizeNumbers(tokens(text), lang)
    .map((token) => token.text)
    .join(' ')

describe('normalizeNumbers — digits', () => {
  it.each([
    ['007', '7'],
    ['000', '0'],
    ['0', '0'],
    ['10', '10'],
    ['1000', '1000'],
  ])('canonicalizes %s → %s', (input, expected) => {
    expect(digits(input, 'en')).toBe(expected)
    expect(digits(input, 'pl')).toBe(expected)
  })

  it('leaves tokens that mix digits and letters alone', () => {
    expect(digits('10th 2nd', 'en')).toBe('10th 2nd')
  })
})

describe('normalizeNumbers — English words', () => {
  it.each([
    ['zero', '0'],
    ['one', '1'],
    ['ten', '10'],
    ['thirteen', '13'],
    ['nineteen', '19'],
    ['forty', '40'],
    ['twenty one', '21'],
    ['ninety nine', '99'],
    ['hundred', '100'],
    ['one hundred', '100'],
    ['a hundred', '100'],
    ['two hundred', '200'],
    ['one hundred and five', '105'],
    ['a hundred and one', '101'],
    ['hundred and ten', '110'],
    ['nine hundred ninety nine', '999'],
    ['nine hundred and ninety nine', '999'],
    ['thousand', '1000'],
    ['one thousand', '1000'],
    ['a thousand', '1000'],
  ])('%s → %s', (words, expected) => {
    expect(digits(words, 'en')).toBe(expected)
  })

  it.each([
    ['twenty twenty', '20 20'],
    ['one two', '1 2'],
    ['nine eleven', '9 11'],
    ['twenty eleven', '20 11'],
    ['zero one', '0 1'],
    ['two thousand', '2 1000'],
    ['one hundred thousand', '100 1000'],
  ])('does not merge %s (→ %s)', (words, expected) => {
    expect(digits(words, 'en')).toBe(expected)
  })

  it('consumes the article only before hundred or thousand', () => {
    expect(digits('a day', 'en')).toBe('a day')
    expect(digits('a hundred days', 'en')).toBe('100 days')
  })

  it('consumes "and" only between hundreds and a number below 100', () => {
    expect(digits('bread and wine', 'en')).toBe('bread and wine')
    expect(digits('one hundred and counting', 'en')).toBe('100 and counting')
    expect(digits('twenty and one', 'en')).toBe('20 and 1')
  })

  it('gives a merged number the raw range of all its words', () => {
    expect(normalizeNumbers(tokens('one hundred and five days'), 'en')).toEqual([
      { text: '105', rawStart: 0, rawEnd: 3 },
      { text: 'days', rawStart: 4, rawEnd: 4 },
    ])
  })

  it('ignores Polish number words', () => {
    expect(digits('pięć', 'en')).toBe('pięć')
  })
})

describe('normalizeNumbers — Polish words', () => {
  it.each([
    ['zero', '0'],
    ['jeden', '1'],
    ['jedna', '1'],
    ['jedno', '1'],
    ['dwa', '2'],
    ['dwie', '2'],
    ['dziesięć', '10'],
    ['jedenaście', '11'],
    ['czterdzieści', '40'],
    ['dwadzieścia jeden', '21'],
    ['dziewięćdziesiąt dziewięć', '99'],
    ['sto', '100'],
    ['sto pięć', '105'],
    ['sto jedenaście', '111'],
    ['dwieście', '200'],
    ['dwieście trzydzieści', '230'],
    ['dziewięćset dziewięćdziesiąt dziewięć', '999'],
    ['tysiąc', '1000'],
  ])('%s → %s', (words, expected) => {
    expect(digits(words, 'pl')).toBe(expected)
  })

  it.each([
    ['dwadzieścia dwadzieścia', '20 20'],
    ['jeden dwa', '1 2'],
    ['dwadzieścia jedenaście', '20 11'],
    ['tysiąc sto', '1000 100'],
    ['sto dwieście', '100 200'],
  ])('does not merge %s (→ %s)', (words, expected) => {
    expect(digits(words, 'pl')).toBe(expected)
  })

  it('does not treat Polish "a" and "i" as English glue words', () => {
    expect(digits('a sto', 'pl')).toBe('a 100')
    expect(digits('sto i pięć', 'pl')).toBe('100 i 5')
  })

  it('gives a merged number the raw range of all its words', () => {
    expect(normalizeNumbers(tokens('mam dwadzieścia jeden lat'), 'pl')).toEqual([
      { text: 'mam', rawStart: 0, rawEnd: 0 },
      { text: '21', rawStart: 1, rawEnd: 2 },
      { text: 'lat', rawStart: 3, rawEnd: 3 },
    ])
  })

  it('ignores English number words', () => {
    expect(digits('one', 'pl')).toBe('one')
  })
})
