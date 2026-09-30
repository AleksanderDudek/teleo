import { describe, expect, it } from 'vitest'
import { learningLang, nativeLang } from './languages'

describe('learningLang', () => {
  it('is the other language: Polish speakers learn English, English speakers learn Polish', () => {
    expect(learningLang('pl')).toBe('en')
    expect(learningLang('en')).toBe('pl')
  })
})

describe('nativeLang', () => {
  it('is the interface language while it differs from the language being learnt', () => {
    expect(nativeLang('en', 'pl')).toBe('pl')
    expect(nativeLang('pl', 'en')).toBe('en')
  })

  it('falls back to the other language after a switch of the interface language mid-dialogue', () => {
    expect(nativeLang('en', 'en')).toBe('pl')
    expect(nativeLang('pl', 'pl')).toBe('en')
  })
})
