import { describe, expect, it } from 'vitest'
import { countWords } from '@/domain/text/countWords'
import { NEED_IDS, needsOf } from '@/domain/text/needs'
import { BUILTIN_SESSIONS, builtinSegments, CORE_TEXTS, expandLibraryText, loadBuiltinTexts, type LibraryTextDef } from './index'

const FORMS = ['m', 'f', 'n'] as const
const BUILTIN_TEXTS = await loadBuiltinTexts()

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

  it('says what every text is for: one to three known needs, every need used (DECISIONS #125)', () => {
    const problems = BUILTIN_TEXTS.flatMap((def) =>
      def.needs.length >= 1 && def.needs.length <= 3 && needsOf(def).length === def.needs.length ? [] : [def.key],
    )
    expect(problems).toEqual([])
    const used = new Set(BUILTIN_TEXTS.flatMap((def) => def.needs))
    expect(NEED_IDS.filter((need) => !used.has(need))).toEqual([])
  })

  it('bundles the core texts and loads the prayer library apart (DECISIONS #126)', () => {
    expect(BUILTIN_TEXTS.slice(0, CORE_TEXTS.length)).toEqual(CORE_TEXTS)
    expect(CORE_TEXTS.some((def) => def.key.includes('.lovy-'))).toBe(false)
  })

  it('pairs every library prayer with its Polish translation, sentence for sentence (DECISIONS #126)', () => {
    const byKey = new Map(BUILTIN_TEXTS.map((def) => [def.key, def]))
    const library = BUILTIN_TEXTS.slice(CORE_TEXTS.length)
    const english = library.filter((def) => def.lang === 'en')
    expect(english.length).toBeGreaterThan(150)
    expect(library.filter((def) => def.lang === 'pl')).toHaveLength(english.length)
    const problems = english.flatMap((en) => {
      const pl = byKey.get(en.key.replace(/^en\./, 'pl.'))
      if (!pl) return [`${en.key}: no Polish pair`]
      return [
        ...(builtinSegments(pl, 'n').length === builtinSegments(en, 'n').length ? [] : [`${en.key}: sentence count`]),
        ...(pl.needs.join() === en.needs.join() ? [] : [`${en.key}: needs differ`]),
        ...(pl.type === en.type && pl.tags.length === en.tags.length ? [] : [`${en.key}: type or tags`]),
        ...(Boolean(pl.note) === Boolean(en.note) ? [] : [`${en.key}: note in one language only`]),
      ]
    })
    expect(problems).toEqual([])
  })

  it('names no public figure in a title, a tag or a note (DECISIONS #134)', () => {
    const named = /Lovy|Elias\b|Ceroń/
    const problems = BUILTIN_TEXTS.filter((def) => [def.title, ...def.tags, def.note ?? ''].some((field) => named.test(field)))
    expect(problems.map((def) => def.key)).toEqual([])
  })

  it('keeps what is read before praying apart from what is said (DECISIONS #132)', () => {
    const problems = BUILTIN_TEXTS.flatMap((def) => [
      ...(def.note === undefined || (def.note.trim() !== '' && !def.note.includes('\n\n\n')) ? [] : [`${def.key}: empty note or paragraph`]),
      // A fill-in like "[name it]" cannot be checked by ear: it belongs in the note, said in one's own words.
      ...FORMS.flatMap((form) => builtinSegments(def, form).filter((segment) => /[[\]]/.test(segment)).map((segment) => `${def.key}/${form}: ${segment}`)),
    ])
    expect(problems).toEqual([])
    const strongholds = BUILTIN_TEXTS.filter((def) => def.key.includes('.stronghold-'))
    expect(strongholds).toHaveLength(58)
    expect(strongholds.every((def) => def.note && def.needs.includes('strongholds') && def.tags.includes('Demony burzące'))).toBe(true)
  })

  it('holds no duplicates: one title per language, and no two texts sharing half their sentences (DECISIONS #130)', () => {
    const fold = (sentence: string) => sentence.toLowerCase().replace(/[^\p{L} ]/gu, '').replace(/\s+/g, ' ').trim()
    const problems: string[] = []
    for (const lang of ['en', 'pl'] as const) {
      const texts = BUILTIN_TEXTS.filter((def) => def.lang === lang)
      const titles = texts.map((def) => def.title.toLowerCase())
      problems.push(...titles.filter((title, index) => titles.indexOf(title) !== index).map((title) => `${lang}: title ${title}`))
      const sentences = texts.map((def) => new Set(builtinSegments(def, 'n').map(fold)))
      for (const [i, a] of sentences.entries()) {
        for (let j = i + 1; j < sentences.length; j++) {
          const b = sentences[j] as Set<string>
          const shared = [...a].filter((sentence) => b.has(sentence)).length
          if (shared / Math.min(a.size, b.size) >= 0.5) problems.push(`${texts[i]?.key} ~ ${texts[j]?.key}`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('expands inline m/f/n sentences of the library into variants', () => {
    const base = { key: 'pl.x', lang: 'pl', type: 'prayer', title: 'X', splitMode: 'sentence', tags: [], needs: [] } satisfies Omit<
      LibraryTextDef,
      'segments'
    >
    const plain = expandLibraryText({ ...base, segments: ['Jeden.', 'Dwa.'] })
    expect(plain).toMatchObject({ segments: ['Jeden.', 'Dwa.'] })
    expect(plain.variants).toBeUndefined()
    const gendered = expandLibraryText({
      ...base,
      segments: ['Jeden.', { m: 'Jestem wolny.', f: 'Jestem wolna.', n: 'Mam wolność.' }],
    })
    expect(gendered.segments).toBeUndefined()
    expect(gendered.variants).toEqual({
      m: ['Jeden.', 'Jestem wolny.'],
      f: ['Jeden.', 'Jestem wolna.'],
      n: ['Jeden.', 'Mam wolność.'],
    })
  })

  it('sessions use the bundled core texts of the same language', () => {
    const texts = new Map(CORE_TEXTS.map((t) => [t.key, t]))
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
