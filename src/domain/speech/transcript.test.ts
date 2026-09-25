import { describe, expect, it } from 'vitest'
import { bestTranscript, collapseCumulative, transcriptAlternatives, type ResultSnapshot } from './transcript'

const r = (isFinal: boolean, ...alternatives: string[]): ResultSnapshot => ({ isFinal, alternatives })

describe('transcripts', () => {
  it('joins the best hypothesis of every result', () => {
    expect(bestTranscript([r(true, 'Ojcze nasz '), r(false, ' któryś jest', 'który jest')])).toBe('Ojcze nasz któryś jest')
  })

  it('offers alternatives for the last result only', () => {
    expect(transcriptAlternatives([r(true, 'I am'), r(false, 'calm', 'come', 'calm')])).toEqual(['I am calm', 'I am come'])
    expect(transcriptAlternatives([])).toEqual([])
  })

  it('drops earlier results that a later one strictly extends (WebKit cumulative results)', () => {
    const results = [r(true, 'Jestem spokojny'), r(true, 'jestem spokojny i pewny siebie')]
    expect(bestTranscript(collapseCumulative(results))).toBe('jestem spokojny i pewny siebie')
  })

  it('keeps genuine repetitions', () => {
    const results = [r(true, 'I am calm'), r(true, 'I am calm')]
    expect(bestTranscript(collapseCumulative(results))).toBe('I am calm I am calm')
  })
})
