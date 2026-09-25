import { describe, expect, it } from 'vitest'
import { analyzeSegments, suggestSplitPoint } from './analyze'

/** `n` copies of `word` joined with single spaces — a segment with no punctuation or digits. */
const words = (n: number, word = 'słowo') => Array<string>(n).fill(word).join(' ')

describe('suggestSplitPoint', () => {
  it('splits after the semicolon when one is present', () => {
    expect(suggestSplitPoint('a b c; d e f g h, i j')).toBe(3)
  })

  it('prefers a semicolon/colon over a comma regardless of distance to the middle', () => {
    // colon at word 2 (dist 2 from middle 4) beats a closer comma at word 3 (dist 1)
    expect(suggestSplitPoint('a b: c, d e f g h')).toBe(2)
  })

  it('picks the semicolon/colon nearest the middle when there are two', () => {
    expect(suggestSplitPoint('a b; c d e f; g h i j')).toBe(6)
  })

  it('falls back to the comma nearest the middle when there is no semicolon or colon', () => {
    expect(suggestSplitPoint('a b, c d e f, g h i j')).toBe(6)
  })

  it('falls back to the middle word boundary with no punctuation', () => {
    expect(suggestSplitPoint('a b c d e f g h i j')).toBe(5)
  })

  it('returns null for fewer than two words', () => {
    expect(suggestSplitPoint('Amen.')).toBeNull()
    expect(suggestSplitPoint('')).toBeNull()
  })

  it('ignores punctuation attached to the very last word (nothing to split off)', () => {
    expect(suggestSplitPoint('a b c d;')).toBe(2)
  })

  it('ignores a colon in the middle of a word, like a clock time', () => {
    // no split marks at all here, so this must fall back to the middle boundary (3)
    expect(suggestSplitPoint('Spotkajmy się o 8:00 rano dzisiaj')).toBe(3)
  })

  it('ignores a colon in the middle of a word, like a bible reference', () => {
    // "3:16" is word 2 (a buggy mid-word match would wrongly suggest 2); with
    // no valid mark, the correct answer is the middle boundary (4) instead
    expect(suggestSplitPoint('J 3:16 mówi codziennie do nas wszystkich tutaj')).toBe(4)
  })

  it('still counts a mark followed only by closing quotes/brackets before the word ends', () => {
    // colon+closing-quote at word 2 is a valid end-of-word mark, so it wins over the middle boundary
    expect(suggestSplitPoint('a b:” c d e f')).toBe(2)
  })
})

describe('analyzeSegments', () => {
  it('flags a 41-word segment as long, with a numeric split suggestion', () => {
    expect(analyzeSegments([words(41)])).toEqual([
      { kind: 'long', index: 0, words: 41, suggestedSplitWord: 21 },
    ])
  })

  it('flags an 81-word segment as tooLong, with a numeric split suggestion', () => {
    expect(analyzeSegments([words(81)])).toEqual([
      { kind: 'tooLong', index: 0, words: 81, suggestedSplitWord: 41 },
    ])
  })

  it('does not flag an exactly-40-word segment at all', () => {
    expect(analyzeSegments([words(40)])).toEqual([])
  })

  it('flags an exactly-80-word segment as long, not tooLong (the hard limit is only above 80)', () => {
    expect(analyzeSegments([words(80)])).toEqual([
      { kind: 'long', index: 0, words: 80, suggestedSplitWord: 40 },
    ])
  })

  it('flags a 2-word segment as short (the boundary is under 3 words)', () => {
    expect(analyzeSegments(['Boże mój.', 'Chwała Panu na wieki.'])).toEqual([
      { kind: 'short', index: 0, words: 2, mergeWith: 'next' },
    ])
  })

  it('flags a short last segment as mergeable with the previous one', () => {
    expect(analyzeSegments(['Chwała Ojcu i Synowi.', 'Amen.'])).toEqual([
      { kind: 'short', index: 1, words: 1, mergeWith: 'previous' },
    ])
  })

  it('flags a short first segment as mergeable with the next one', () => {
    expect(analyzeSegments(['Amen.', 'Chwała Ojcu i Synowi.'])).toEqual([
      { kind: 'short', index: 0, words: 1, mergeWith: 'next' },
    ])
  })

  it('does not flag a short segment when it is the only one', () => {
    expect(analyzeSegments(['Amen.'])).toEqual([])
  })

  it('flags digits with a hint to write numbers as words', () => {
    expect(analyzeSegments(['Mam 10 celów.'])).toEqual([{ kind: 'digits', index: 0 }])
  })

  it('flags more than 150 segments as tooMany', () => {
    const segments = Array<string>(151).fill('Ala ma kota.')
    expect(analyzeSegments(segments)).toEqual([{ kind: 'tooMany', count: 151 }])
  })

  it('does not flag exactly 150 segments', () => {
    const segments = Array<string>(150).fill('Ala ma kota.')
    expect(analyzeSegments(segments)).toEqual([])
  })

  it('returns no issues for a clean list', () => {
    expect(analyzeSegments(['Ala ma kota.', 'Idzie do szkoły.'])).toEqual([])
  })

  it('orders issues by index, with tooMany first', () => {
    const segments = [...Array<string>(151).fill('Ala ma kota.')]
    segments[3] = 'Amen.'
    segments[80] = words(41)
    const issues = analyzeSegments(segments)
    expect(issues.map((issue) => issue.kind)).toEqual(['tooMany', 'short', 'long'])
    expect(issues[1]).toMatchObject({ index: 3 })
    expect(issues[2]).toMatchObject({ index: 80 })
  })

  it('can report multiple issues for the same segment', () => {
    const longWithDigits = `${words(41)} 5`
    expect(analyzeSegments([longWithDigits])).toEqual([
      { kind: 'long', index: 0, words: 42, suggestedSplitWord: 21 },
      { kind: 'digits', index: 0 },
    ])
  })
})
