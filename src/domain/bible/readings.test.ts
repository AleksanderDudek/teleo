import { describe, expect, it } from 'vitest'
import { countWords, planReadings, type Verse } from './readings'

/** A verse of `words` words, ending with `end`. */
const verse = (c: number, v: number, words: number, end = '.'): Verse => ({ c, v, t: `${Array.from({ length: words }, (_, i) => `w${i}`).join(' ')}${end}` })

describe('countWords', () => {
  it('counts words with letters or digits, ignoring stray punctuation', () => {
    expect(countWords('And God said, Let there be light: and there was light.')).toBe(11)
    expect(countWords('Zdrowaś Maryjo — łaski pełna')).toBe(4)
    expect(countWords('  ')).toBe(0)
  })
})

describe('planReadings', () => {
  it('closes a reading at the first sentence end after a minute of words', () => {
    // 50 + 50 (clause) + 50 (sentence) → 150 ≥ 140 at a sentence end; the rest is the next reading.
    const verses = [verse(1, 1, 50), verse(1, 2, 50, ';'), verse(1, 3, 50), verse(1, 4, 60), verse(1, 5, 90)]
    expect(planReadings(verses, 140)).toEqual([
      { from: [1, 1], to: [1, 3], words: 150 },
      { from: [1, 4], to: [1, 5], words: 150 },
    ])
  })

  it('never ends a reading inside a sentence, even when it runs longer', () => {
    const verses = [verse(1, 1, 100, ','), verse(1, 2, 60, ','), verse(1, 3, 20), verse(1, 4, 150)]
    expect(planReadings(verses, 140)[0]).toEqual({ from: [1, 1], to: [1, 3], words: 180 })
  })

  it('prefers a chapter end once most of a minute is read, and runs on into the next chapter otherwise', () => {
    const verses = [verse(1, 1, 90), verse(2, 1, 40), verse(2, 2, 40), verse(3, 1, 150)]
    expect(planReadings(verses, 140)).toEqual([
      { from: [1, 1], to: [1, 1], words: 90 }, // 90 ≥ 60 % of 140 at the chapter end
      { from: [2, 1], to: [3, 1], words: 230 }, // 80 < 84 at the end of chapter 2 → runs on
    ])
  })

  it('may close a runaway sentence at a clause end after two and a half minutes', () => {
    const verses = [verse(1, 1, 200, ','), verse(1, 2, 160, ';'), verse(1, 3, 100)]
    expect(planReadings(verses, 140)[0]).toEqual({ from: [1, 1], to: [1, 2], words: 360 })
  })

  it('folds a short tail of the book into the previous reading', () => {
    const verses = [verse(1, 1, 150), verse(1, 2, 150), verse(1, 3, 20)]
    expect(planReadings(verses, 140)).toEqual([
      { from: [1, 1], to: [1, 1], words: 150 },
      { from: [1, 2], to: [1, 3], words: 170 },
    ])
  })

  it('treats closing quotes and brackets after the full stop as a sentence end', () => {
    const verses = [verse(1, 1, 150, '.’'), verse(1, 2, 150, '?)')]
    expect(planReadings(verses, 140)).toHaveLength(2)
  })

  it('closes at any verse end after four minutes, as a last resort', () => {
    const verses = [verse(1, 1, 300, ','), verse(1, 2, 300, ','), verse(1, 3, 100)]
    expect(planReadings(verses, 140)[0]).toEqual({ from: [1, 1], to: [1, 2], words: 600 })
  })

  it('keeps a whole short book as one reading', () => {
    expect(planReadings([verse(1, 1, 30), verse(1, 2, 25)], 140)).toEqual([{ from: [1, 1], to: [1, 2], words: 55 }])
  })
})
