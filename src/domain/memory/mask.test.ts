import { describe, expect, it } from 'vitest'
import { maskWords, MEMORY_LEVELS } from './mask'

const view = (content: string, level: Parameters<typeof maskWords>[1], revealed?: readonly boolean[]) =>
  maskWords(content, level, revealed).map((w) => w.text).join(' ')

describe('maskWords', () => {
  it('lists the levels from easiest to hardest', () => {
    expect(MEMORY_LEVELS).toEqual(['initials', 'alternate', 'hidden'])
  })

  it('keeps first letters and punctuation at the "initials" level', () => {
    expect(view('Ojcze nasz, któryś jest w niebie.', 'initials')).toBe('O···· n···, k····· j··· w n·····.')
  })

  it('hides every second word at the "alternate" level', () => {
    expect(view('Jestem spokojny i pewny siebie.', 'alternate')).toBe('Jestem ········ i ····· siebie.')
  })

  it('hides every word at the "hidden" level, keeping only punctuation', () => {
    expect(view('I am calm, and focused.', 'hidden')).toBe('· ·· ····, ··· ·······.')
  })

  it('reveals words the speaker has already said', () => {
    expect(view('I am calm.', 'hidden', [true, true, false])).toBe('I am ····.')
  })

  it('flags masked words', () => {
    expect(maskWords('Ala ma kota', 'alternate').map((w) => w.masked)).toEqual([false, true, false])
    expect(maskWords('Ala ma', 'initials').map((w) => w.masked)).toEqual([true, true])
  })

  it('handles digits and quotes like letters and punctuation', () => {
    expect(view('„Mam 10 celów”', 'initials')).toBe('„M·· 1· c····”')
  })
})
