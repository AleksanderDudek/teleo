import { describe, expect, it } from 'vitest'
import { matchPrefix, progressOf } from './live'
import type { PrefixOptions } from './types'

const JESTEM = 'Jestem spokojny i pewny siebie.'
const PL_20 =
  'Każdego dnia rano wstaję wcześnie, dziękuję za nowy dzień i spokojnie planuję wszystkie ważne sprawy, które czekają na mnie dzisiaj.'
const EN_20 =
  'Every morning I choose to breathe slowly, listen carefully, speak kindly and walk calmly toward the goals that matter most.'

const pl: PrefixOptions = { lang: 'pl', strictness: 'strict' }
const en: PrefixOptions = { lang: 'en', strictness: 'strict' }

/** The words of a sentence as a transcript would have them: lowercase, no punctuation. */
const spokenWords = (sentence: string) => sentence.toLowerCase().replace(/[.,]/g, '').split(' ')

describe('matchPrefix', () => {
  it('accepts the sentence and leaves the rest of the window for the next one', () => {
    const match = matchPrefix(JESTEM, 'jestem spokojny i pewny siebie chleba naszego', pl)
    expect(match?.consumedRawWords).toBe(5)
    expect(match?.result).toMatchObject({
      accepted: true,
      coverage: 1,
      matched: 5,
      extra: 0,
      reason: null,
      bestAlternativeIndex: 0,
      transcript: 'jestem spokojny i pewny siebie',
    })
    expect(match?.result.ops).toHaveLength(5)
  })

  it('waits while the sentence is unfinished', () => {
    expect(matchPrefix(JESTEM, 'jestem spokojny i pewny', pl)).toBeNull()
  })

  it('rejects an extra word inside the sentence', () => {
    expect(matchPrefix(JESTEM, 'jestem bardzo spokojny i pewny siebie', pl)).toBeNull()
  })

  it('never accepts before the last word is said, even at 95% coverage', () => {
    expect(matchPrefix(PL_20, spokenWords(PL_20).slice(0, 19).join(' '), pl)).toBeNull()
  })

  it('accepts one omitted word in 20 once the last word is said', () => {
    const said = spokenWords(PL_20).filter((_, index) => index !== 6)
    expect(matchPrefix(PL_20, [...said, 'chleba'].join(' '), pl)).toMatchObject({
      consumedRawWords: 19,
      result: { accepted: true, coverage: 0.95, missing: 1 },
    })
  })

  it('skips the repeated tail of the previous sentence', () => {
    const match = matchPrefix('I am calm', 'calm I am calm I am calm', {
      ...en,
      previousTail: ['am', 'calm'],
    })
    expect(match?.consumedRawWords).toBe(4)
    expect(match?.result.ops.map((entry) => entry.op)).toEqual(['match', 'match', 'match'])
  })

  it('does not swallow a genuine repetition as the previous tail', () => {
    const match = matchPrefix('I am calm', 'I am calm I am calm', {
      ...en,
      previousTail: ['i', 'am', 'calm'],
    })
    expect(match?.consumedRawWords).toBe(3)
  })

  it('skips at most three tail words', () => {
    const options = { ...en, previousTail: ['you', 'are', 'so', 'kind'] }
    expect(matchPrefix('I am calm', 'are so kind I am calm', options)?.consumedRawWords).toBe(6)
    expect(matchPrefix('I am calm', 'you are so kind I am calm', options)).toBeNull()
  })

  it('skips only leading tail words', () => {
    expect(matchPrefix('I am calm', 'I am so calm', { ...en, previousTail: ['so'] })).toBeNull()
  })

  it('consumes the raw words of a number spelled out', () => {
    expect(matchPrefix('Mam 10 celów.', 'mam dziesięć celów i', pl)?.consumedRawWords).toBe(3)
  })

  it('consumes fillers before the end of the sentence but not after it', () => {
    expect(matchPrefix('I am calm', 'um I am calm', en)?.consumedRawWords).toBe(4)
    expect(matchPrefix('I am calm', 'I am calm um', en)?.consumedRawWords).toBe(3)
  })

  it('accepts a wrong word inside the sentence only in lenient mode', () => {
    const said = spokenWords(EN_20).map((word, index) => (index === 12 ? 'run' : word))
    const window = [...said, 'amen'].join(' ')
    expect(matchPrefix(EN_20, window, { ...en, strictness: 'lenient' })).toMatchObject({
      consumedRawWords: 20,
      result: { accepted: true, wrong: 1, coverage: 0.95 },
    })
    expect(matchPrefix(EN_20, window, en)).toBeNull()
  })

  it('has nothing to accept without words on either side', () => {
    expect(matchPrefix('—', 'anything', en)).toBeNull()
    expect(matchPrefix('I am calm', '', en)).toBeNull()
    expect(matchPrefix('I am calm', 'um', en)).toBeNull()
  })
})

describe('progressOf', () => {
  it('marks the words said so far', () => {
    expect(progressOf(JESTEM, 'jestem spokojny', 'pl')).toEqual({
      covered: [true, true, false, false, false],
      errors: 0,
      lastCovered: 1,
    })
  })

  it('counts an extra word as an error', () => {
    expect(progressOf(JESTEM, 'jestem bardzo spokojny', 'pl')).toEqual({
      covered: [true, true, false, false, false],
      errors: 1,
      lastCovered: 1,
    })
  })

  it('counts a wrong word as an error', () => {
    expect(progressOf('I am calm today', 'I am cold today', 'en')).toEqual({
      covered: [true, true, false, true],
      errors: 1,
      lastCovered: 3,
    })
  })

  it('reads a word left out as skipped rather than the next word as extra', () => {
    expect(progressOf(JESTEM, 'jestem spokojny pewny', 'pl')).toEqual({
      covered: [true, true, false, true, false],
      errors: 0,
      lastCovered: 3,
    })
  })

  it('counts near matches as said and ignores fillers', () => {
    expect(progressOf('Zdrowaś Maryjo, łaski pełna', 'yyy zdrowas maryjo', 'pl')).toEqual({
      covered: [true, true, false, false],
      errors: 0,
      lastCovered: 1,
    })
  })

  it("covers a raw word only once all its tokens are said (I'm = i + am)", () => {
    expect(progressOf("I'm calm", 'I', 'en').covered).toEqual([false, false])
    expect(progressOf("I'm calm", 'I am', 'en')).toMatchObject({
      covered: [true, false],
      lastCovered: 0,
    })
  })

  it('never covers a word without letters or digits', () => {
    expect(progressOf('Ojcze nasz — któryś jest', 'ojcze nasz któryś', 'pl')).toMatchObject({
      covered: [true, true, false, true, false],
      lastCovered: 3,
    })
  })

  it('has nothing covered before anything is said', () => {
    expect(progressOf(JESTEM, '', 'pl')).toEqual({
      covered: [false, false, false, false, false],
      errors: 0,
      lastCovered: -1,
    })
  })
})
