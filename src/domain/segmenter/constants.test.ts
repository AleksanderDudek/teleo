import { describe, expect, it } from 'vitest'
import {
  ABBREVIATION_DOT_PLACEHOLDER,
  LONG_SEGMENT_WORDS,
  MAX_SEGMENTS_PER_TEXT,
  MAX_WORDS_PER_SEGMENT,
  SHORT_SEGMENT_WORDS,
} from './constants'

describe('segmenter constants', () => {
  it('match the spec §7.2 thresholds', () => {
    expect(MAX_SEGMENTS_PER_TEXT).toBe(150)
    expect(MAX_WORDS_PER_SEGMENT).toBe(80)
    expect(LONG_SEGMENT_WORDS).toBe(40)
    expect(SHORT_SEGMENT_WORDS).toBe(3)
  })

  it('uses a private-use placeholder, not U+2024 (ICU still treats that as a terminator)', () => {
    expect(ABBREVIATION_DOT_PLACEHOLDER).toBe('')
    expect(ABBREVIATION_DOT_PLACEHOLDER).not.toBe('․')
  })
})
