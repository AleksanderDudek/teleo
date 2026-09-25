import { describe, expect, it } from 'vitest'
import type { Lang } from '@/domain/types'
import { buildDiff } from './diff'
import { evaluate } from './evaluate'
import type { DiffPart, DiffStatus } from './types'

const diff = (lang: Lang, source: string, said: string) =>
  buildDiff(source, lang, evaluate(source, [said], { lang, strictness: 'strict' }))
const word = (text: string, status: DiffStatus): DiffPart => ({ kind: 'source', text, status })
const spoken = (text: string, status: 'extra' | 'wrong'): DiffPart => ({
  kind: 'spoken',
  text,
  status,
})

const JESTEM = 'Jestem spokojny i pewny siebie.'

describe('buildDiff', () => {
  it('shows every original word with its punctuation', () => {
    expect(diff('en', 'Hail Mary, full of grace.', 'hail mary full of grace')).toEqual([
      word('Hail', 'match'),
      word('Mary,', 'match'),
      word('full', 'match'),
      word('of', 'match'),
      word('grace.', 'match'),
    ])
  })

  it('marks a missing word', () => {
    expect(diff('pl', JESTEM, 'jestem spokojny pewny siebie')).toEqual([
      word('Jestem', 'match'),
      word('spokojny', 'match'),
      word('i', 'missing'),
      word('pewny', 'match'),
      word('siebie.', 'match'),
    ])
  })

  it('marks near matches', () => {
    expect(diff('pl', 'Zdrowaś Maryjo, łaski pełna', 'zdrowas maryjo laski pelna')).toEqual([
      word('Zdrowaś', 'near'),
      word('Maryjo,', 'match'),
      word('łaski', 'near'),
      word('pełna', 'near'),
    ])
  })

  it('puts an extra word said first before the first word', () => {
    expect(diff('en', 'I am calm', 'so I am calm')).toEqual([
      spoken('so', 'extra'),
      word('I', 'match'),
      word('am', 'match'),
      word('calm', 'match'),
    ])
  })

  it('puts an extra word after the source word said before it', () => {
    expect(diff('pl', JESTEM, 'jestem bardzo spokojny i pewny siebie')).toEqual([
      word('Jestem', 'match'),
      spoken('bardzo', 'extra'),
      word('spokojny', 'match'),
      word('i', 'match'),
      word('pewny', 'match'),
      word('siebie.', 'match'),
    ])
  })

  it('puts an extra word said last after the last word', () => {
    expect(diff('en', 'I am calm.', 'I am calm now')).toEqual([
      word('I', 'match'),
      word('am', 'match'),
      word('calm.', 'match'),
      spoken('now', 'extra'),
    ])
  })

  it('places an extra word after a missing one', () => {
    expect(diff('pl', JESTEM, 'jestem spokojny pewny siebie teraz')).toEqual([
      word('Jestem', 'match'),
      word('spokojny', 'match'),
      word('i', 'missing'),
      word('pewny', 'match'),
      word('siebie.', 'match'),
      spoken('teraz', 'extra'),
    ])
  })

  it('keeps consecutive extra words in spoken order', () => {
    expect(diff('en', 'I am calm', 'I am so very calm')).toEqual([
      word('I', 'match'),
      word('am', 'match'),
      spoken('so', 'extra'),
      spoken('very', 'extra'),
      word('calm', 'match'),
    ])
  })

  it('shows what was said instead of a wrong word right after it', () => {
    expect(diff('en', 'I am calm.', 'I am cold')).toEqual([
      word('I', 'match'),
      word('am', 'match'),
      word('calm.', 'wrong'),
      spoken('cold', 'wrong'),
    ])
  })

  it("gives I'm the worst status of its two tokens", () => {
    expect(diff('en', "I'm here", 'I am here')).toEqual([
      word("I'm", 'match'),
      word('here', 'match'),
    ])
    expect(diff('en', "I'm here", 'I here')).toEqual([
      word("I'm", 'missing'),
      word('here', 'match'),
    ])
    expect(diff('en', "I'm here", 'you am here')).toEqual([
      word("I'm", 'wrong'),
      spoken('you', 'wrong'),
      word('here', 'match'),
    ])
  })

  it('colours every raw word of a merged number and shows the wrong number once', () => {
    expect(diff('pl', 'Dwadzieścia jeden dni', '21 dni')).toEqual([
      word('Dwadzieścia', 'match'),
      word('jeden', 'match'),
      word('dni', 'match'),
    ])
    expect(diff('pl', 'Dwadzieścia jeden dni', '22 dni')).toEqual([
      word('Dwadzieścia', 'wrong'),
      word('jeden', 'wrong'),
      spoken('22', 'wrong'),
      word('dni', 'match'),
    ])
  })

  it('leaves words without letters or digits uncoloured', () => {
    expect(diff('pl', 'Ojcze nasz — któryś jest', 'ojcze nasz któryś jest')).toEqual([
      word('Ojcze', 'match'),
      word('nasz', 'match'),
      word('—', 'none'),
      word('któryś', 'match'),
      word('jest', 'match'),
    ])
  })

  it('leaves every word uncoloured when nothing was heard', () => {
    expect(diff('en', 'I am calm.', 'um')).toEqual([
      word('I', 'none'),
      word('am', 'none'),
      word('calm.', 'none'),
    ])
    expect(diff('en', '—', 'anything')).toEqual([word('—', 'none')])
  })
})
