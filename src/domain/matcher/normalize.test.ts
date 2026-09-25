import { describe, expect, it } from 'vitest'
import type { Lang } from '@/domain/types'
import { normalize, rawWords } from './normalize'

const texts = (text: string, lang: Lang) =>
  normalize(text, lang)
    .map((token) => token.text)
    .join(' ')

describe('rawWords', () => {
  it('splits the trimmed text on any whitespace', () => {
    expect(rawWords('  Zdrowaś Maryjo,\nłaski\tpełna ')).toEqual(['Zdrowaś', 'Maryjo,', 'łaski', 'pełna'])
  })

  it('has no words for blank text', () => {
    expect(rawWords('')).toEqual([])
    expect(rawWords(' \n ')).toEqual([])
  })
})

describe('normalize — tokens and raw ranges', () => {
  it("expands I'm into two tokens of the same raw word", () => {
    expect(normalize("I'm here", 'en')).toEqual([
      { text: 'i', rawStart: 0, rawEnd: 0 },
      { text: 'am', rawStart: 0, rawEnd: 0 },
      { text: 'here', rawStart: 1, rawEnd: 1 },
    ])
  })

  it('reads a hyphenated number as one number of one raw word', () => {
    expect(normalize('twenty-one days', 'en')).toEqual([
      { text: '21', rawStart: 0, rawEnd: 0 },
      { text: 'days', rawStart: 1, rawEnd: 1 },
    ])
  })

  it('merges a number spelled with two raw words into one token', () => {
    expect(normalize('Dwadzieścia jeden dni', 'pl')).toEqual([
      { text: '21', rawStart: 0, rawEnd: 1 },
      { text: 'dni', rawStart: 2, rawEnd: 2 },
    ])
  })

  it('drops punctuation-only words but keeps counting raw words', () => {
    expect(normalize('Ojcze nasz — któryś jest', 'pl')).toEqual([
      { text: 'ojcze', rawStart: 0, rawEnd: 0 },
      { text: 'nasz', rawStart: 1, rawEnd: 1 },
      { text: 'któryś', rawStart: 3, rawEnd: 3 },
      { text: 'jest', rawStart: 4, rawEnd: 4 },
    ])
  })

  it('splits hyphenated words into tokens of the same raw word', () => {
    expect(normalize('biało-czerwony', 'pl')).toEqual([
      { text: 'biało', rawStart: 0, rawEnd: 0 },
      { text: 'czerwony', rawStart: 0, rawEnd: 0 },
    ])
  })

  it('has no tokens for blank or punctuation-only text', () => {
    expect(normalize('', 'pl')).toEqual([])
    expect(normalize('  — … !', 'en')).toEqual([])
  })
})

describe('normalize — characters', () => {
  it('gives identical tokens for NFC and NFD input', () => {
    const text = 'Zdrowaś Maryjo, łaski pełna, Pan z Tobą. Żółć gęślą jaźń.'
    expect(normalize(text.normalize('NFD'), 'pl')).toEqual(normalize(text.normalize('NFC'), 'pl'))
    expect(texts(text.normalize('NFD'), 'pl')).toBe('zdrowaś maryjo łaski pełna pan z tobą żółć gęślą jaźń')
  })

  it('lowercases Polish capitals', () => {
    expect(texts('ŁĄKA ŻÓŁĆ Ślęża', 'pl')).toBe('łąka żółć ślęża')
  })

  it('removes punctuation and symbols', () => {
    expect(texts('„Jestem” (spokojny) [i] «pewny» siebie…!? — 100% "tak"; a/b', 'pl')).toBe(
      'jestem spokojny i pewny siebie 100 tak a b',
    )
  })

  it('turns dashes between words into word breaks', () => {
    expect(texts('peace–love—joy', 'en')).toBe('peace love joy')
  })

  it.each(['I’m', 'I‘m', 'Iʼm', 'I´m', 'I`m'])('unifies the apostrophe in %s', (word) => {
    expect(texts(word, 'en')).toBe('i am')
  })

  it('strips remaining apostrophes and drops apostrophe-only tokens', () => {
    expect(texts("God's love", 'en')).toBe('gods love')
    expect(texts("' rock 'n' roll '", 'en')).toBe('rock n roll')
  })

  it('reads quotes around a contraction as quotes', () => {
    expect(texts('‘I’m enough.’', 'en')).toBe('i am enough')
  })
})

describe('normalize — numbers', () => {
  it('canonicalizes digits and converts number words', () => {
    expect(texts('Mam 10 celów.', 'pl')).toBe('mam 10 celów')
    expect(texts('mam dziesięć celów', 'pl')).toBe('mam 10 celów')
    expect(texts('Agent 007', 'en')).toBe('agent 7')
    expect(texts('One hundred and five', 'en')).toBe('105')
  })

  it('drops thousands separators inside digit groups', () => {
    expect(texts('1,000 days', 'en')).toBe('1000 days')
    expect(texts('1,000,000', 'en')).toBe('1000000')
  })

  it('keeps a decimal comma as a word break', () => {
    expect(texts('3,14', 'pl')).toBe('3 14')
  })

  it('joins digit groups separated by a (narrow) no-break space', () => {
    expect(normalize('1 000 dni', 'pl')).toEqual([
      { text: '1000', rawStart: 0, rawEnd: 1 },
      { text: 'dni', rawStart: 2, rawEnd: 2 },
    ])
    expect(texts('1 000 000', 'pl')).toBe('1000000')
    expect(texts('(10 000)', 'pl')).toBe('10000')
  })

  it('does not join digit groups separated by a plain space', () => {
    expect(texts('1 000', 'pl')).toBe('1 0')
  })
})

describe('normalize — English only', () => {
  it('expands contractions', () => {
    expect(texts("Don't worry, it's fine", 'en')).toBe('do not worry it is fine')
  })

  it('joins "can not" and "for ever"', () => {
    expect(normalize('I can not stop', 'en')).toEqual([
      { text: 'i', rawStart: 0, rawEnd: 0 },
      { text: 'cannot', rawStart: 1, rawEnd: 2 },
      { text: 'stop', rawStart: 3, rawEnd: 3 },
    ])
    expect(texts("I can't stop", 'en')).toBe('i cannot stop')
    expect(texts('for ever and ever', 'en')).toBe('forever and ever')
  })

  it('leaves Polish text alone', () => {
    expect(texts("can't can not", 'pl')).toBe('cant can not')
  })
})
