import { describe, expect, it } from 'vitest'
import { isHiddenText, isListedTemplate, isListedText } from './visibility'

describe('isListedText', () => {
  it('lists texts in the interface language only; Bible readings and dialogues never', () => {
    expect(isListedText({ source: 'builtin', lang: 'pl' }, 'pl')).toBe(true)
    expect(isListedText({ source: 'builtin', lang: 'en' }, 'pl')).toBe(false)
    expect(isListedText({ source: 'user', lang: 'en' }, 'en')).toBe(true)
    expect(isListedText({ source: 'user', lang: 'en' }, 'pl')).toBe(false)
    expect(isListedText({ source: 'bible', lang: 'pl' }, 'pl')).toBe(false)
    expect(isListedText({ source: 'dialogue', lang: 'pl' }, 'pl')).toBe(false)
  })
})

describe('isHiddenText', () => {
  it('is true for the texts a feature creates (Bible readings, dialogues)', () => {
    expect(isHiddenText({ source: 'bible' })).toBe(true)
    expect(isHiddenText({ source: 'dialogue' })).toBe(true)
    expect(isHiddenText({ source: 'builtin' })).toBe(false)
    expect(isHiddenText({ source: 'user' })).toBe(false)
  })
})

describe('isListedTemplate', () => {
  const texts = new Map([
    ['pl1', { lang: 'pl' as const }],
    ['en1', { lang: 'en' as const }],
  ])
  it('uses the language of a builtin session', () => {
    expect(isListedTemplate({ lang: 'en', items: [] }, texts, 'pl')).toBe(false)
    expect(isListedTemplate({ lang: 'pl', items: [] }, texts, 'pl')).toBe(true)
  })

  it('takes a user session’s language from its texts', () => {
    expect(isListedTemplate({ items: [{ textId: 'pl1' }] }, texts, 'pl')).toBe(true)
    expect(isListedTemplate({ items: [{ textId: 'en1' }] }, texts, 'pl')).toBe(false)
    expect(isListedTemplate({ items: [{ textId: 'gone' }, { textId: 'en1' }] }, texts, 'en')).toBe(true)
  })

  it('keeps a session whose texts are all gone visible, so it can still be fixed or deleted', () => {
    expect(isListedTemplate({ items: [{ textId: 'gone' }] }, texts, 'pl')).toBe(true)
    expect(isListedTemplate({ items: [] }, texts, 'en')).toBe(true)
  })
})
