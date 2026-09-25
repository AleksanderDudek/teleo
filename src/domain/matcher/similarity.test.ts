import { describe, expect, it } from 'vitest'
import { compareWords, levenshtein, stripDiacritics } from './similarity'

describe('stripDiacritics', () => {
  it('removes every Polish diacritic, including ł which has no decomposition', () => {
    expect(stripDiacritics('zażółć gęślą jaźń')).toBe('zazolc gesla jazn')
    expect(stripDiacritics('ŁĄKA ŻÓŁW Ćma Źle Ńa Śruba Ęe')).toBe('LAKA ZOLW Cma Zle Na Sruba Ee')
  })

  it('handles decomposed (NFD) input', () => {
    expect(stripDiacritics('Zdrowaś'.normalize('NFD'))).toBe('Zdrowas')
  })

  it('leaves plain words untouched', () => {
    expect(stripDiacritics('grace')).toBe('grace')
  })
})

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['', 'abc', 3],
    ['abc', '', 3],
    ['same', 'same', 0],
    ['kitten', 'sitting', 3],
    ['flaw', 'lawn', 2],
    ['calm', 'cold', 2],
    ['naszego', 'waszego', 1],
  ])('distance(%j, %j) = %i', (a, b, expected) => {
    expect(levenshtein(a, b)).toBe(expected)
    expect(levenshtein(b, a)).toBe(expected)
  })
})

describe('compareWords', () => {
  it('matches identical words', () => {
    expect(compareWords('pełna', 'pełna')).toBe('match')
  })

  it('treats a diacritics-only difference as near', () => {
    expect(compareWords('zdrowaś', 'zdrowas')).toBe('near')
    expect(compareWords('łaski', 'laski')).toBe('near')
  })

  it('allows only a diacritics difference for words of up to 3 letters', () => {
    expect(compareWords('się', 'sie')).toBe('near')
    expect(compareWords('am', 'an')).toBe('none')
    expect(compareWords('dni', 'dno')).toBe('none')
  })

  it('needs both words to have at least 4 letters for fuzzy tolerance', () => {
    expect(compareWords('walk', 'wal')).toBe('none')
  })

  it('accepts similarity of exactly 0.8 and rejects anything lower', () => {
    expect(compareWords('abcde', 'abcdx')).toBe('near')
    expect(compareWords('abcd', 'abcx')).toBe('none')
    expect(compareWords('abcd', 'abxy')).toBe('none')
  })

  it('measures similarity after stripping diacritics', () => {
    expect(compareWords('wdzięczna', 'wdzieczny')).toBe('near')
  })

  it('tolerates one-letter recognition slips in longer words', () => {
    expect(compareWords('naszego', 'waszego')).toBe('near')
  })

  it('rejects clearly different words', () => {
    expect(compareWords('calm', 'cold')).toBe('none')
  })
})
