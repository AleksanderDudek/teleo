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
    const problems = BUILTIN_TEXTS.flatMap((def) => {
      if (!def.variants) return def.segments?.length ? [] : [`${def.key}: no segments`]
      const lengths = new Set(FORMS.map((form) => def.variants?.[form].length))
      return [
        ...(def.lang === 'pl' ? [] : [`${def.key}: variants are Polish-only`]),
        ...(lengths.size === 1 ? [] : [`${def.key}: variant lengths differ`]),
      ]
    })
    expect(problems).toEqual([])
  })

  it('keeps segments speakable: 3–40 words, no digits (spec §7.2)', () => {
    const problems = BUILTIN_TEXTS.flatMap((def) =>
      FORMS.flatMap((form) =>
        builtinSegments(def, form).flatMap((segment) => {
          const words = countWords(segment)
          return words < 3 || words > 40 || /\d/.test(segment) ? [`${def.key}/${form}: ${segment}`] : []
        }),
      ),
    )
    expect(problems).toEqual([])
  })

  it('sessions reference existing texts of the same language', () => {
    const texts = new Map(BUILTIN_TEXTS.map((t) => [t.key, t]))
    const problems = BUILTIN_SESSIONS.flatMap((session) =>
      session.items.flatMap((item) =>
        texts.get(item.text)?.lang === session.lang && item.repeat >= 1 ? [] : [`${session.key} → ${item.text}`],
      ),
    )
    expect(problems).toEqual([])
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
