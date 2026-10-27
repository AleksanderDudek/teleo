import { describe, expect, it } from 'vitest'
import { bestTranscript, collapseCumulative, showsGrowth, transcriptAlternatives, type ResultSnapshot } from './transcript'

const r = (isFinal: boolean, ...alternatives: string[]): ResultSnapshot => ({ isFinal, alternatives })

describe('transcripts', () => {
  it('joins the best hypothesis of every result', () => {
    expect(bestTranscript([r(true, 'Ojcze nasz '), r(false, ' któryś jest', 'który jest')])).toBe('Ojcze nasz któryś jest')
  })

  it('offers alternatives for the last result only', () => {
    expect(transcriptAlternatives([r(true, 'I am'), r(false, 'calm', 'come', 'calm')])).toEqual(['I am calm', 'I am come'])
    expect(transcriptAlternatives([])).toEqual([])
  })

  it('drops earlier results that a later one strictly extends (cumulative results)', () => {
    const results = [r(true, 'Jestem spokojny'), r(true, 'jestem spokojny i pewny siebie')]
    expect(bestTranscript(collapseCumulative(results))).toBe('jestem spokojny i pewny siebie')
  })

  it('collapses a growing chain whatever its punctuation and case (Android: one result per growth step, all final)', () => {
    const results = [r(true, 'Jestem'), r(true, 'Jestem spokojny.'), r(true, 'jestem spokojny i pewny siebie')]
    expect(bestTranscript(collapseCumulative(results))).toBe('jestem spokojny i pewny siebie')
  })

  it('drops a late report that repeats or shortens the previous one', () => {
    expect(bestTranscript(collapseCumulative([r(true, 'I am calm and focused'), r(true, 'I am calm')]))).toBe('I am calm and focused')
    expect(bestTranscript(collapseCumulative([r(true, 'I am calm'), r(true, 'I am calm')]))).toBe('I am calm')
  })

  it('replaces a result whose last words the recogniser revised', () => {
    const results = [r(true, 'Ojcze nasz któryś jest w niebie'), r(false, 'Ojcze nasz któryś jest w niebiesiech święć się')]
    expect(bestTranscript(collapseCumulative(results))).toBe('Ojcze nasz któryś jest w niebiesiech święć się')
  })

  it('keeps the next phrase, even one that opens like the last', () => {
    const litany = [r(true, 'Święta Maryjo módl się za nami'), r(true, 'Święta Boża Rodzicielko módl się za nami')]
    expect(bestTranscript(collapseCumulative(litany))).toBe('Święta Maryjo módl się za nami Święta Boża Rodzicielko módl się za nami')
    expect(bestTranscript(collapseCumulative([r(true, 'I am calm'), r(true, 'and focused')]))).toBe('I am calm and focused')
  })

  it('tells cumulative reports by a chain of three growing results, not by one repeated start', () => {
    expect(showsGrowth([r(true, 'I'), r(true, 'I am'), r(false, 'I am calm')])).toBe(true)
    expect(showsGrowth([r(true, 'Hail Mary'), r(true, 'Hail Mary full of grace')])).toBe(false)
    expect(showsGrowth([r(true, 'I am calm'), r(true, 'I am calm'), r(true, 'I am calm')])).toBe(false)
  })
})
