import { describe, expect, it } from 'vitest'
import { readingMs, WORDS_PER_MINUTE } from './pace'

describe('reading pace', () => {
  it('assumes a calm reading-aloud pace per language', () => {
    // Polish words are longer (more syllables), so fewer of them fit in a minute.
    expect(WORDS_PER_MINUTE).toEqual({ en: 140, pl: 110 })
  })

  it('estimates the time a number of words takes to say', () => {
    expect(readingMs(140, 'en')).toBe(60_000)
    expect(readingMs(55, 'pl')).toBe(30_000)
    expect(readingMs(7, 'en')).toBe(3_000)
  })

  it('never goes negative', () => {
    expect(readingMs(-4, 'en')).toBe(0)
  })
})
