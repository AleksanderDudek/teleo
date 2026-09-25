import { describe, expect, it } from 'vitest'
import { countWords } from '@/domain/text/countWords'
import { BUILTIN_SESSIONS, BUILTIN_TEXTS, builtinSegments } from './index'

const FORMS = ['m', 'f', 'n'] as const

describe('builtin content', () => {
  it('has unique keys with a language prefix', () => {
    const keys = [...BUILTIN_TEXTS.map((t) => t.key), ...BUILTIN_SESSIONS.map((s) => s.key)]
    expect(new Set(keys).size).toBe(keys.length)
    for (const def of [...BUILTIN_TEXTS, ...BUILTIN_SESSIONS]) expect(def.key.startsWith(`${def.lang}.`)).toBe(true)
  })

  it('defines valid literal fields', () => {
    for (const def of BUILTIN_TEXTS) {
      expect(['pl', 'en']).toContain(def.lang)
      expect(['affirmation', 'prayer', 'text']).toContain(def.type)
      expect(['sentence', 'line']).toContain(def.splitMode)
      expect(def.title.trim()).not.toBe('')
    }
  })

  it('gives every text segments (or three equally long grammatical variants)', () => {
    for (const def of BUILTIN_TEXTS) {
      if (def.variants) {
        expect(def.lang).toBe('pl')
        const lengths = FORMS.map((form) => def.variants?.[form].length)
        expect(new Set(lengths).size).toBe(1)
      } else {
        expect(def.segments?.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps segments speakable: 3–40 words, no digits (spec §7.2)', () => {
    for (const def of BUILTIN_TEXTS) {
      for (const form of FORMS) {
        for (const segment of builtinSegments(def, form)) {
          const words = countWords(segment)
          expect(words, segment).toBeGreaterThanOrEqual(3)
          expect(words, segment).toBeLessThanOrEqual(40)
          expect(segment, segment).not.toMatch(/\d/)
        }
      }
    }
  })

  it('sessions reference existing texts of the same language', () => {
    const texts = new Map(BUILTIN_TEXTS.map((t) => [t.key, t]))
    for (const session of BUILTIN_SESSIONS) {
      for (const item of session.items) {
        expect(texts.get(item.text)?.lang, `${session.key} → ${item.text}`).toBe(session.lang)
        expect(item.repeat).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('expands the rosary decades to 26 (PL) and 36 (EN) segments', () => {
    const texts = new Map(BUILTIN_TEXTS.map((t) => [t.key, t]))
    const size = (key: string) => {
      const session = BUILTIN_SESSIONS.find((s) => s.key === key)!
      return session.items.reduce((sum, item) => sum + builtinSegments(texts.get(item.text)!, 'n').length * item.repeat, 0)
    }
    expect(size('pl.dziesiatka-rozanca')).toBe(26)
    expect(size('en.decade-of-the-rosary')).toBe(36)
    expect(size('pl.poranne-afirmacje')).toBe(10)
    expect(size('en.morning-affirmations')).toBe(10)
  })
})
