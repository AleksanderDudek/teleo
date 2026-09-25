import { describe, expect, it } from 'vitest'
import type { Lang } from '@/domain/types'
import { removeFillers } from './fillers'
import type { Token } from './types'

const tokens = (text: string): Token[] =>
  text.split(' ').map((word, index) => ({ text: word, rawStart: index, rawEnd: index }))
const clean = (text: string, lang: Lang, keep: readonly string[] = []) =>
  removeFillers(tokens(text), lang, new Set(keep))
    .map((token) => token.text)
    .join(' ')

describe('removeFillers', () => {
  it('removes English hesitation sounds', () => {
    expect(clean('um i umm uum am uh uhh er err grateful hmm hm mm mmm', 'en')).toBe(
      'i am grateful',
    )
  })

  it('keeps English words that merely look similar', () => {
    expect(clean('umbrella her hum mum me ermine', 'en')).toBe('umbrella her hum mum me ermine')
  })

  it('removes Polish hesitation sounds', () => {
    expect(clean('yyy jestem yy eee ee spokojny hmm hm mmm mm', 'pl')).toBe('jestem spokojny')
  })

  it('applies only the fillers of the given language', () => {
    expect(clean('um uh er y e', 'pl')).toBe('um uh er y e')
    expect(clean('yyy eee', 'en')).toBe('yyy eee')
  })

  it('keeps a filler that is a word of the source', () => {
    expect(clean('to err is human', 'en', ['to', 'err', 'is', 'human'])).toBe('to err is human')
    expect(clean('hmm hmm', 'pl', ['hmm'])).toBe('hmm hmm')
  })

  it('keeps the raw ranges of the remaining tokens', () => {
    expect(removeFillers(tokens('um i am'), 'en', new Set())).toEqual([
      { text: 'i', rawStart: 1, rawEnd: 1 },
      { text: 'am', rawStart: 2, rawEnd: 2 },
    ])
  })
})
