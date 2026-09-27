import { describe, expect, it } from 'vitest'
import type { Lang } from '@/domain/types'
import { COVERAGE_LADDER, coverageNeeded, evaluate } from './evaluate'
import type { EvaluateOptions } from './types'

const JESTEM = 'Jestem spokojny i pewny siebie.'
const PL_20 =
  'Każdego dnia rano wstaję wcześnie, dziękuję za nowy dzień i spokojnie planuję wszystkie ważne sprawy, które czekają na mnie dzisiaj.'
const EN_20 =
  'Every morning I choose to breathe slowly, listen carefully, speak kindly and walk calmly toward the goals that matter most.'

/** `failedTries` picks the rung of the coverage ladder; 0 = the first try (90 %). */
const run = (lang: Lang, source: string, alternatives: readonly string[], failedTries = 0) =>
  evaluate(source, alternatives, { lang, threshold: coverageNeeded(failedTries) })
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
      threshold: 0.9,
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

  it('#3 rejects 80% coverage on the first try', () => {
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

  it('#5 accepts two omitted words in a 20-word sentence (90%), not three (85%), on the first try', () => {
    expect(pl(PL_20, omitting(PL_20, 2, 10))).toMatchObject({
      accepted: true,
      reason: null,
      coverage: 0.9,
    })
    expect(pl(PL_20, omitting(PL_20, 2, 10, 15))).toMatchObject({
      accepted: false,
      reason: 'coverage',
      coverage: 0.85,
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

  it('#12 rejects a different short word (it counts as not said)', () => {
    expect(en('I am calm', 'I am cold')).toMatchObject({
      accepted: false,
      reason: 'coverage',
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
        threshold: 0.9,
        reason: 'empty',
        transcript: '',
      })
    },
  )

  it('#14 counts a misheard word as not said, never as extra', () => {
    const result = en('I am calm', 'I am cold')
    expect(result).toMatchObject({ accepted: false, reason: 'coverage', wrong: 1, extra: 0 })
    expect(result.coverage).toBeCloseTo(2 / 3)
  })

  it('#15 accepts one misheard word in 20 (95%)', () => {
    expect(en(EN_20, replacing(EN_20, 12, 'run'))).toMatchObject({
      accepted: true,
      reason: null,
      wrong: 1,
      coverage: 0.95,
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
    const alternatives = ['I am very calm and focused', 'I am calm and focused']
    expect(run('en', 'I am calm and focused', alternatives)).toMatchObject({
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
    expect(result.ops.map((entry) => entry.op)).toEqual([
      'match',
      'match',
      'match',
      'match',
      'match',
    ])
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
      threshold: 0.9,
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
  it('needs every word below 10 words on the first try (90% of 9 is more than 8)', () => {
    const nine = spokenWords(PL_20).slice(0, 9).join(' ')
    expect(pl(nine, omitting(nine, 0))).toMatchObject({ accepted: false, reason: 'coverage', sourceWords: 9 })
    const ten = spokenWords(PL_20).slice(0, 10).join(' ')
    expect(pl(ten, omitting(ten, 0))).toMatchObject({ accepted: true, sourceWords: 10 })
  })

  it('counts near matches toward coverage', () => {
    expect(pl('Zdrowaś Maryjo', 'zdrowas maryjo').coverage).toBe(1)
  })

  it('reports extra before wrong', () => {
    expect(en('I am calm', 'I am cold today')).toMatchObject({
      reason: 'extra',
      extra: 1,
      wrong: 1,
    })
  })

  it('rejects extra words on every rung of the ladder', () => {
    expect(run('en', 'I am calm', ['I am very calm'], 5)).toMatchObject({
      accepted: false,
      reason: 'extra',
    })
  })

  it('honours a custom threshold', () => {
    const threshold = (value: number): EvaluateOptions => ({ lang: 'pl', threshold: value })
    expect(evaluate(JESTEM, ['jestem spokojny pewny siebie'], threshold(0.8)).accepted).toBe(true)
    expect(evaluate(PL_20, [omitting(PL_20, 2)], threshold(1)).accepted).toBe(false)
  })

  it("reads an archaic -'d elision as one word close to the spoken -ed form", () => {
    expect(en("Hallow'd be thy name", 'hallowed be thy name')).toMatchObject({
      accepted: true,
      near: 1,
    })
  })

  it('matches Polish number words said without diacritics', () => {
    expect(pl('Dwadzieścia jeden dni', 'dwadziescia jeden dni')).toMatchObject({
      accepted: true,
      matched: 2,
    })
  })

  it('rejects a long number that is one digit off', () => {
    expect(pl('Mam 10000 kroków', 'mam 10001 kroków')).toMatchObject({
      accepted: false,
      reason: 'coverage',
      wrong: 1,
    })
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
    expect(en('I am calm', '', 'um', 'I am calm')).toMatchObject({
      accepted: true,
      bestAlternativeIndex: 2,
    })
  })

  it('prefers higher coverage among rejected alternatives', () => {
    expect(en('I am calm and focused', 'I am', 'I am calm')).toMatchObject({
      accepted: false,
      bestAlternativeIndex: 1,
      coverage: 0.6,
    })
  })

  it('prefers fewer extra and wrong words at equal coverage', () => {
    const alternatives = ['so I am calm and very focused', 'I am calm and focused now']
    expect(run('en', 'I am calm and focused', alternatives)).toMatchObject({
      bestAlternativeIndex: 1,
      extra: 1,
    })
  })

  it('prefers the lower alignment cost next', () => {
    const source = 'Chleba naszego powszedniego'
    const near = 'chleba waszego powszedniego'
    const exact = 'chleba naszego powszedniego'
    expect(pl(source, near, exact)).toMatchObject({
      accepted: true,
      bestAlternativeIndex: 1,
      near: 0,
    })
    expect(pl(source, `${near} amen`, `${exact} amen`)).toMatchObject({
      accepted: false,
      bestAlternativeIndex: 1,
    })
  })

  it('keeps the earlier alternative on a full tie', () => {
    expect(en('I am calm', 'I am calm', 'i am calm')).toMatchObject({
      bestAlternativeIndex: 0,
      transcript: 'I am calm',
    })
  })
})

describe('evaluate — speech-recognition artefacts (owner report 2026-09-27)', () => {
  it('accepts two words the recogniser wrote as one (w niebie → wniebie)', () => {
    const result = pl('Ojcze nasz, któryś jest w niebie.', 'ojcze nasz któryś jest wniebie')
    expect(result).toMatchObject({ accepted: true, matched: 6, extra: 0, missing: 0 })
    expect(result.ops.slice(-2)).toEqual([
      { op: 'match', source: 'w', spoken: 'wniebie', sourceIndex: 4 },
      { op: 'match', source: 'niebie', spoken: 'wniebie', sourceIndex: 5 },
    ])
  })

  it('accepts one word the recogniser wrote as two (niekształtowna → nie kształtowna)', () => {
    const result = pl('A ziemia była niekształtowna i próżna.', 'a ziemia była nie kształtowna i próżna')
    expect(result).toMatchObject({ accepted: true, extra: 0, missing: 0 })
    expect(result.ops[3]).toEqual({ op: 'match', source: 'niekształtowna', spoken: 'nie kształtowna', sourceIndex: 3 })
  })

  it('tolerates missing Polish letters in a split or merged word', () => {
    expect(pl('Na wieki wieków.', 'nawieki wiekow')).toMatchObject({ accepted: true })
    expect(pl('Była niekształtowna.', 'byla nie ksztaltowna')).toMatchObject({ accepted: true })
  })

  it('accepts the same sound spelled differently, even in short words (ó/u, rz/ż, ch/h)', () => {
    expect(pl('Na początku stworzył Bóg niebo i ziemię.', 'na początku stworzył bug niebo i ziemię')).toMatchObject({ accepted: true, near: 1 })
    expect(pl('Ujrzał morze.', 'ujrzał może')).toMatchObject({ accepted: true, near: 1 })
    expect(pl('Chleba naszego powszedniego daj nam dzisiaj.', 'hleba naszego powszedniego daj nam dzisiaj')).toMatchObject({ accepted: true })
  })

  it('still rejects an extra word glued to a neighbour', () => {
    expect(pl(JESTEM, 'jestem spokojny i pewny siebiebardzo')).toMatchObject({ accepted: false })
    expect(pl('Jestem spokojny.', 'jestem spokojny i')).toMatchObject({ accepted: false, reason: 'extra' })
  })

  it('still rejects a missing word next to a similar one', () => {
    expect(pl('I odpuść nam nasze winy.', 'i odpuść nasze winy')).toMatchObject({ accepted: false, reason: 'coverage', missing: 1 })
  })

  it('keeps English sounds apart (ch/h only matter in Polish)', () => {
    expect(en('Wear a hat.', 'wear a chat')).toMatchObject({ accepted: false, wrong: 1 })
  })

  it('accepts an English word split in two, and two English words said as one', () => {
    expect(en('I will not give up any more.', 'I will not give up anymore')).toMatchObject({ accepted: true })
    expect(en('It is a new day, every day.', 'it is a new day everyday')).toMatchObject({ accepted: true })
  })
})

describe('evaluate — the coverage ladder (owner request 2026-09-27)', () => {
  const TEN = 'Każdego dnia rano wstaję wcześnie i dziękuję za nowy dzień.'
  const tryNo = (failedTries: number, source: string, spoken: string) => run('pl', source, [spoken], failedTries)

  it('needs 90 % on the first try, 80 % on the second, 70 % from the third on', () => {
    expect(COVERAGE_LADDER).toEqual([0.9, 0.8, 0.7])
    expect([0, 1, 2, 3, 4, 10].map(coverageNeeded)).toEqual([0.9, 0.8, 0.7, 0.7, 0.7, 0.7])
  })

  it('lets one more word in ten be lost with each failed try, down to three', () => {
    expect(tryNo(0, TEN, omitting(TEN, 3))).toMatchObject({ accepted: true, missing: 1 })
    expect(tryNo(0, TEN, omitting(TEN, 3, 6))).toMatchObject({ accepted: false, reason: 'coverage' })
    expect(tryNo(1, TEN, omitting(TEN, 3, 6))).toMatchObject({ accepted: true, missing: 2 })
    expect(tryNo(1, TEN, omitting(TEN, 3, 6, 8))).toMatchObject({ accepted: false, reason: 'coverage' })
    expect(tryNo(2, TEN, omitting(TEN, 3, 6, 8))).toMatchObject({ accepted: true, missing: 3 })
    expect(tryNo(7, TEN, omitting(TEN, 1, 3, 6, 8))).toMatchObject({ accepted: false, reason: 'coverage' })
  })

  it('counts a misheard word as lost, not as extra, on every rung', () => {
    expect(tryNo(0, TEN, replacing(TEN, 3, 'wstałem'))).toMatchObject({ accepted: true, wrong: 1 })
  })

  it('reads a percentage as "at least": a short sentence may need every word at first', () => {
    expect(tryNo(0, JESTEM, omitting(JESTEM, 1))).toMatchObject({ accepted: false, coverage: 0.8 })
    expect(tryNo(1, JESTEM, omitting(JESTEM, 1))).toMatchObject({ accepted: true, coverage: 0.8 })
    expect(tryNo(2, 'Ojcze nasz.', 'ojcze')).toMatchObject({ accepted: false, coverage: 0.5 })
  })

  it('still rejects extra words and reports the coverage it needed', () => {
    expect(tryNo(2, TEN, `${spokenWords(TEN).join(' ')} bardzo`)).toMatchObject({ accepted: false, reason: 'extra', threshold: 0.7 })
    expect(tryNo(1, TEN, spokenWords(TEN).join(' '))).toMatchObject({ accepted: true, threshold: 0.8 })
  })
})
