import { describe, expect, it } from 'vitest'
import { countWords } from './countWords'

describe('countWords', () => {
  it.each([
    ['Jestem spokojny i pewny siebie.', 5],
    ['  a  b ', 2],
    ['— – ,', 0],
    ["I'm here", 2],
    ['Mam 10 celów.', 3],
    ['', 0],
    ['Zdrowaś Maryjo,\nłaski pełna', 4],
  ])('%j has %i words', (text, expected) => {
    expect(countWords(text)).toBe(expected)
  })
})
