import { describe, expect, it } from 'vitest'
import * as segmenter from './index'

describe('segmenter public API', () => {
  it('re-exports the full contract', () => {
    expect(segmenter.MAX_SEGMENTS_PER_TEXT).toBe(150)
    expect(segmenter.MAX_WORDS_PER_SEGMENT).toBe(80)
    expect(segmenter.LONG_SEGMENT_WORDS).toBe(40)
    expect(segmenter.SHORT_SEGMENT_WORDS).toBe(3)
    expect(typeof segmenter.splitIntoSegments).toBe('function')
    expect(typeof segmenter.analyzeSegments).toBe('function')
    expect(typeof segmenter.suggestSplitPoint).toBe('function')
    expect(typeof segmenter.splitSegmentAt).toBe('function')
    expect(typeof segmenter.mergeWithNext).toBe('function')
    expect(typeof segmenter.replaceSegment).toBe('function')
    expect(typeof segmenter.isBlocking).toBe('function')
  })

  it('wires the pieces together end to end', () => {
    const segments = segmenter.splitIntoSegments(
      'Ojcze nasz, któryś jest w niebie. Amen.',
      'pl',
      'sentence',
    )
    const issues = segmenter.analyzeSegments(segments)
    expect(issues).toEqual([{ kind: 'short', index: 1, words: 1, mergeWith: 'previous' }])
    expect(segmenter.mergeWithNext(segments, 0)).toEqual([
      'Ojcze nasz, któryś jest w niebie. Amen.',
    ])
  })
})
