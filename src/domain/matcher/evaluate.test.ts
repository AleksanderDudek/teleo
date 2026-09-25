import { describe, expect, it } from 'vitest'
import type { Lang, Strictness } from '@/domain/types'
import { evaluate } from './evaluate'

const PL_20 =
  'Każdego dnia rano wstaję wcześnie, dziękuję za nowy dzień i spokojnie planuję wszystkie ważne sprawy, które czekają na mnie dzisiaj.'
const EN_20 =
  'Every morning I choose to breathe slowly, listen carefully, speak kindly and walk calmly toward the goals that matter most.'

const run = (
  lang: Lang,
  source: string,
  alternatives: readonly string[],
  strictness: Strictness = 'strict',
) => evaluate(source, alternatives, { lang, strictness })
const pl = (source: string, ...alternatives: string[]) => run('pl', source, alternatives)
const en = (source: string, ...alternatives: string[]) => run('en', source, alternatives)

/** The words of a sentence as a transcript would have them: lowercase, no punctuation. */
const spokenWords = (sentence: string) => sentence.toLowerCase().replace(/[.,]/g, '').split(' ')
const omitting = (sentence: string, ...indexes: number[]) =>
  spokenWords(sentence)
    .filter((_, index) => !indexes.includes(index))
    .join(' ')
const replacing = (sentence: string, index: number, word: string) =>
  spokenWords(sentence)
    .map((original, i) => (i === index ? word : original))
    .join(' ')

describe('evaluate — spec §6.6 table', () => {
  const JESTEM = 'Jestem spokojny i pewny siebie.'

  it('#1 accepts an exact transcript', () => {
    expect(pl(JESTEM, 'jestem spokojny i pewny siebie')).toEqual({
      accepted: true,
      coverage: 1,
      matched: 5,
      near: 0,
      missing: 0,
      extra: 0,
      wrong: 0,
      ops: [
        { op: 'match', source: 'jestem', spoken: 'jestem', sourceIndex: 0 },
        { op: 'match', source: 'spokojny', spoken: 'spokojny', sourceIndex: 1 },
        { op: 'match', source: 'i', spoken: 'i', sourceIndex: 2 },
        { op: 'match', source: 'pewny', spoken: 'pewny', sourceIndex: 3 },
        { op: 'match', source: 'siebie', spoken: 'siebie', sourceIndex: 4 },
      ],
      bestAlternativeIndex: 0,
      sourceWords: 5,
      reason: null,
      transcript: 'jestem spokojny i pewny siebie',
    })
  })

  it('#2 rejects an extra word', () => {
    const result = pl(JESTEM, 'jestem bardzo spokojny i pewny siebie')
    expect(result).toMatchObject({ accepted: false, reason: 'extra', extra: 1, coverage: 1 })
    expect(result.ops.filter((entry) => entry.op === 'extra')).toEqual([
      { op: 'extra', spoken: 'bardzo' },
    ])
  })

  it('#3 rejects 80% coverage', () => {
    expect(pl(JESTEM, 'jestem spokojny pewny siebie')).toMatchObject({
      accepted: false,
      reason: 'coverage',
      coverage: 0.8,
      missing: 1,
    })
  })

  it('#4 accepts one omitted word in a 20-word sentence (95%)', () => {
    expect(pl(PL_20, omitting(PL_20, 2))).toMatchObject({
      accepted: true,
      reason: null,
      coverage: 0.95,
      missing: 1,
      sourceWords: 20,
    })
  })

  it('#5 rejects two omitted words in a 20-word sentence (90%)', () => {
    expect(pl(PL_20, omitting(PL_20, 2, 10))).toMatchObject({
      accepted: false,
      reason: 'coverage',
      coverage: 0.9,
    })
  })

  it('#6 expands a contraction', () => {
    expect(en('I am enough.', "I'm enough")).toMatchObject({ accepted: true, matched: 3 })
  })

  it('#7 tolerates missing Polish diacritics as near matches', () => {
    expect(pl('Zdrowaś Maryjo, łaski pełna', 'zdrowas maryjo laski pelna')).toMatchObject({
      accepted: true,
      near: 3,
      matched: 1,
      coverage: 1,
    })
  })

  it('#8 ignores a filler', () => {
    expect(en('I am grateful for today.', 'um I am grateful for today')).toMatchObject({
      accepted: true,
      extra: 0,
    })
  })

  it('#9 rejects a repeated word', () => {
    expect(en('I am grateful for today.', 'I am grateful for for today')).toMatchObject({
      accepted: false,
      reason: 'extra',
      extra: 1,
    })
  })

  it('#10 matches digits with number words', () => {
    expect(pl('Mam 10 celów.', 'mam dziesięć celów')).toMatchObject({ accepted: true, matched: 3 })
  })

  it('#11 tolerates a one-letter slip in a long word', () => {
    expect(pl('Chleba naszego powszedniego', 'chleba waszego powszedniego')).toMatchObject({
      accepted: true,
      near: 1,
    })
  })

  it('#12 rejects a different short word', () => {
    expect(en('I am calm', 'I am cold')).toMatchObject({
      accepted: false,
      reason: 'wrong',
      wrong: 1,
    })
  })

  it.each([[['']], [['   ']], [['um']], [[]], [['', 'um uh']]])(
    '#13 rejects an empty transcript %j',
    (alternatives) => {
      expect(run('en', 'I am calm', alternatives)).toEqual({
        accepted: false,
        coverage: 0,
        matched: 0,
        near: 0,
        missing: 0,
        extra: 0,
        wrong: 0,
        ops: [],
        bestAlternativeIndex: -1,
        sourceWords: 3,
        reason: 'empty',
        transcript: '',
      })
    },
  )

  it('#14 lenient mode counts a wrong word as missing', () => {
    const result = run('en', 'I am calm', ['I am cold'], 'lenient')
    expect(result).toMatchObject({ accepted: false, reason: 'coverage', wrong: 1 })
    expect(result.coverage).toBeCloseTo(2 / 3)
  })

  it('#15 lenient mode accepts one wrong word in 20; strict mode does not', () => {
    const transcript = replacing(EN_20, 12, 'run')
    expect(run('en', EN_20, [transcript], 'lenient')).toMatchObject({
      accepted: true,
      reason: null,
      wrong: 1,
      coverage: 0.95,
    })
    expect(run('en', EN_20, [transcript], 'strict')).toMatchObject({
      accepted: false,
      reason: 'wrong',
      wrong: 1,
    })
  })

  it('#16 matches a hyphenated number with digits', () => {
    expect(en('Twenty-one days', '21 days')).toMatchObject({ accepted: true })
  })

  it('#17 matches a compound English number with digits', () => {
    expect(en('One hundred and five', '105')).toMatchObject({ accepted: true, sourceWords: 1 })
  })

  it('#18 matches a two-word Polish number with digits', () => {
    expect(pl('Dwadzieścia jeden dni', '21 dni')).toMatchObject({ accepted: true })
  })

  it.each(["I can't stop", 'I can not stop'])('#19 matches "I cannot stop" with %j', (said) => {
    expect(en('I cannot stop', said)).toMatchObject({ accepted: true })
  })

  it('#20 matches a possessive without its apostrophe', () => {
    expect(en("God's love", 'gods love')).toMatchObject({ accepted: true })
  })

  it('#21 keeps a filler-like word that the source contains', () => {
    expect(en('To err is human', 'to err is human')).toMatchObject({ accepted: true, matched: 4 })
  })

  it('#22 picks the accepted alternative', () => {
    expect(en('I am calm and focused', 'I am very calm and focused', 'I am calm and focused')).toMatchObject({
      accepted: true,
      bestAlternativeIndex: 1,
      transcript: 'I am calm and focused',
    })
  })

  it('#23 rejects a repeated phrase', () => {
    expect(pl('Ojcze nasz', 'Ojcze nasz, Ojcze nasz')).toMatchObject({
      accepted: false,
      reason: 'extra',
      extra: 2,
    })
  })

  it('#24 ignores punctuation', () => {
    const result = en('Hail Mary, full of grace', 'hail mary full of grace')
    expect(result.accepted).toBe(true)
    expect(result.ops.map((entry) => entry.op)).toEqual(['match', 'match', 'match', 'match', 'match'])
  })

  it('#25 rejects a source without words', () => {
    expect(en('—', 'anything')).toEqual({
      accepted: false,
      coverage: 0,
      matched: 0,
      near: 0,
      missing: 0,
      extra: 0,
      wrong: 0,
      ops: [],
      bestAlternativeIndex: -1,
      sourceWords: 0,
      reason: 'emptySource',
      transcript: '',
    })
  })

  it('#26 matches the KJV spelling "for ever"', () => {
    expect(en('for ever', 'forever')).toMatchObject({ accepted: true })
  })

  it('#27 rejects an extra word even when coverage is enough', () => {
    const transcript = omitting(PL_20, 2).replace('planuję', 'planuję bardzo')
    expect(pl(PL_20, transcript)).toMatchObject({
      accepted: false,
      reason: 'extra',
      extra: 1,
      coverage: 0.95,
    })
  })

  it('#28 accepts a one-letter grammatical ending difference (known trade-off)', () => {
    // "wdzięczna" vs "wdzięczny" is 1 edit in 9 letters (similarity 0.89 ≥ 0.8), so the
    // STT-slip tolerance also forgives a wrong grammatical form. Kept as specified:
    // rejecting it would reject real recognition errors in endings too.
    expect(pl('Jestem wdzięczna', 'jestem wdzięczny')).toMatchObject({ accepted: true, near: 1 })
  })
})

describe('evaluate — acceptance rule', () => {
  it('needs every word below 20 words (95% of 19 is more than 18)', () => {
    const nineteen = spokenWords(PL_20).slice(0, 19).join(' ')
    const result = pl(nineteen, omitting(nineteen, 0))
    expect(result).toMatchObject({ accepted: false, reason: 'coverage', sourceWords: 19 })
  })

  it('counts near matches toward coverage', () => {
    expect(pl('Zdrowaś Maryjo', 'zdrowas maryjo').coverage).toBe(1)
  })

  it('reports extra before wrong', () => {
    expect(en('I am calm', 'I am cold today')).toMatchObject({ reason: 'extra', extra: 1, wrong: 1 })
  })

  it('rejects extra words in lenient mode too', () => {
    expect(run('en', 'I am calm', ['I am very calm'], 'lenient')).toMatchObject({
      accepted: false,
      reason: 'extra',
    })
  })

  it('honours a custom threshold', () => {
    const source = 'Jestem spokojny i pewny siebie.'
    const said = 'jestem spokojny pewny siebie'
    expect(evaluate(source, [said], { lang: 'pl', strictness: 'strict', threshold: 0.8 }).accepted).toBe(true)
    expect(evaluate(PL_20, [omitting(PL_20, 2)], { lang: 'pl', strictness: 'strict', threshold: 1 }).accepted).toBe(
      false,
    )
  })

  it('counts source words after normalization', () => {
    expect(en("I'm calm", 'I am calm')).toMatchObject({ accepted: true, sourceWords: 3 })
  })

  it('returns the chosen transcript untouched', () => {
    expect(en('I am calm', ' I am calm! ').transcript).toBe(' I am calm! ')
  })
})

describe('evaluate — choosing among alternatives', () => {
  it('skips alternatives that are empty after normalization', () => {
    expect(en('I am calm', '', 'um', 'I am calm')).toMatchObject({ accepted: true, bestAlternativeIndex: 2 })
  })

  it('prefers higher coverage among rejected alternatives', () => {
    expect(en('I am calm and focused', 'I am', 'I am calm')).toMatchObject({
      accepted: false,
      bestAlternativeIndex: 1,
      coverage: 0.6,
    })
  })

  it('prefers fewer extra and wrong words at equal coverage', () => {
    expect(en('I am calm and focused', 'so I am calm and very focused', 'I am calm and focused now')).toMatchObject({
      bestAlternativeIndex: 1,
      extra: 1,
    })
  })

  it('prefers the lower alignment cost next', () => {
    expect(pl('Chleba naszego powszedniego', 'chleba waszego powszedniego', 'chleba naszego powszedniego')).toMatchObject({
      accepted: true,
      bestAlternativeIndex: 1,
      near: 0,
    })
    expect(
      pl('Chleba naszego powszedniego', 'chleba waszego powszedniego amen', 'chleba naszego powszedniego amen'),
    ).toMatchObject({ accepted: false, bestAlternativeIndex: 1 })
  })

  it('keeps the earlier alternative on a full tie', () => {
    expect(en('I am calm', 'I am calm', 'i am calm')).toMatchObject({ bestAlternativeIndex: 0, transcript: 'I am calm' })
  })
})
