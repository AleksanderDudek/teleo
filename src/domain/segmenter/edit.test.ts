import { describe, expect, it } from 'vitest'
import type { SegmentIssue } from './analyze'
import { isBlocking, mergeWithNext, replaceSegment, splitSegmentAt } from './edit'

describe('splitSegmentAt', () => {
  it('splits a segment into two parts at the given word index', () => {
    const segments = ['Chwała Ojcu i Synowi, i Duchowi Świętemu.', 'Amen.']
    expect(splitSegmentAt(segments, 0, 4)).toEqual([
      'Chwała Ojcu i Synowi,',
      'i Duchowi Świętemu.',
      'Amen.',
    ])
  })

  it('does not mutate the input array', () => {
    const segments = ['Ala ma kota i psa.']
    const snapshot = [...segments]
    splitSegmentAt(segments, 0, 2)
    expect(segments).toEqual(snapshot)
  })

  it('throws RangeError for an out-of-range segment index', () => {
    expect(() => splitSegmentAt(['Ala ma kota.'], 5, 1)).toThrow(RangeError)
    expect(() => splitSegmentAt(['Ala ma kota.'], -1, 1)).toThrow(RangeError)
  })

  it('throws RangeError for a wordIndex of 0 or below', () => {
    expect(() => splitSegmentAt(['Ala ma kota.'], 0, 0)).toThrow(RangeError)
    expect(() => splitSegmentAt(['Ala ma kota.'], 0, -1)).toThrow(RangeError)
  })

  it('throws RangeError for a wordIndex at or beyond the word count', () => {
    // 'Ala ma kota.' has 3 words, so 3 (the whole segment) and beyond are invalid
    expect(() => splitSegmentAt(['Ala ma kota.'], 0, 3)).toThrow(RangeError)
    expect(() => splitSegmentAt(['Ala ma kota.'], 0, 10)).toThrow(RangeError)
  })

  it('throws RangeError for a non-integer or NaN wordIndex', () => {
    expect(() => splitSegmentAt(['Ala ma kota.'], 0, 1.5)).toThrow(RangeError)
    expect(() => splitSegmentAt(['Ala ma kota.'], 0, Number.NaN)).toThrow(RangeError)
  })

  it('throws RangeError when either resulting part would have zero real words', () => {
    // 'Idę dalej —' has 3 whitespace tokens, but the em dash alone is not a word
    expect(() => splitSegmentAt(['Idę dalej —'], 0, 2)).toThrow(RangeError)
  })
})

describe('mergeWithNext', () => {
  it('joins a segment with the next one using a single space', () => {
    expect(mergeWithNext(['Amen.', 'Chwała Ojcu.'], 0)).toEqual(['Amen. Chwała Ojcu.'])
  })

  it('only merges the targeted pair, leaving the rest untouched', () => {
    expect(mergeWithNext(['A', 'B', 'C'], 1)).toEqual(['A', 'B C'])
  })

  it('does not mutate the input array', () => {
    const segments = ['A', 'B', 'C']
    const snapshot = [...segments]
    mergeWithNext(segments, 0)
    expect(segments).toEqual(snapshot)
  })

  it('throws RangeError for an out-of-range segment index', () => {
    expect(() => mergeWithNext(['A'], 5)).toThrow(RangeError)
    expect(() => mergeWithNext(['A'], -1)).toThrow(RangeError)
  })

  it('throws RangeError when asked to merge the last segment with a next one', () => {
    expect(() => mergeWithNext(['A', 'B'], 1)).toThrow(RangeError)
    expect(() => mergeWithNext(['A'], 0)).toThrow(RangeError)
  })
})

describe('replaceSegment', () => {
  it('replaces a segment with trimmed content', () => {
    expect(replaceSegment(['A', 'B', 'C'], 1, '  New content  ')).toEqual(['A', 'New content', 'C'])
  })

  it('removes the segment when the new content is empty after trimming', () => {
    expect(replaceSegment(['A', 'B', 'C'], 1, '   ')).toEqual(['A', 'C'])
    expect(replaceSegment(['A', 'B', 'C'], 1, '')).toEqual(['A', 'C'])
  })

  it('collapses newlines and whitespace runs, since a segment is always a single line', () => {
    expect(replaceSegment(['A', 'B', 'C'], 1, '  New\n  content   here  ')).toEqual([
      'A',
      'New content here',
      'C',
    ])
  })

  it('does not mutate the input array', () => {
    const segments = ['A', 'B', 'C']
    const snapshot = [...segments]
    replaceSegment(segments, 1, 'New content')
    expect(segments).toEqual(snapshot)
  })

  it('throws RangeError for an out-of-range segment index', () => {
    expect(() => replaceSegment(['A'], 5, 'x')).toThrow(RangeError)
    expect(() => replaceSegment(['A'], -1, 'x')).toThrow(RangeError)
  })
})

describe('isBlocking', () => {
  it('is true for tooLong and tooMany', () => {
    const tooLong: SegmentIssue = { kind: 'tooLong', index: 0, words: 90, suggestedSplitWord: 45 }
    const tooMany: SegmentIssue = { kind: 'tooMany', count: 200 }
    expect(isBlocking(tooLong)).toBe(true)
    expect(isBlocking(tooMany)).toBe(true)
  })

  it('is false for long, short and digits', () => {
    const long: SegmentIssue = { kind: 'long', index: 0, words: 45, suggestedSplitWord: 22 }
    const short: SegmentIssue = { kind: 'short', index: 0, words: 1, mergeWith: 'next' }
    const digits: SegmentIssue = { kind: 'digits', index: 0 }
    expect(isBlocking(long)).toBe(false)
    expect(isBlocking(short)).toBe(false)
    expect(isBlocking(digits)).toBe(false)
  })
})
