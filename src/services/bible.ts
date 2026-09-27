import { db } from '@/db/schema'
import type { Segment, SessionRun, TextItem } from '@/db/types'
import type { Verse } from '@/domain/bible/readings'
import { readingSegments, readingText } from '@/domain/bible/segments'
import { TRANSLATION_LANG, type BibleTranslation } from '@/domain/bible/types'
import { countWords } from '@/domain/text/countWords'
import { startRun } from './sessions'

/** `public/bible/<translation>/index.json` (written by `npm run bible`). */
export interface BibleIndex {
  translation: BibleTranslation
  lang: 'en' | 'pl'
  name: string
  license: string
  source: string
  wordsPerMinute: number
  readings: number
  words: number
  books: Array<{ b: string; chapters: number; words: number; readings: number }>
}

/** `public/bible/<translation>/<BOOK>.json`: verses `[chapter, verse, text]`, readings `[fromC, fromV, toC, toV, words]`. */
export interface BibleBook {
  t: BibleTranslation
  b: string
  v: Array<[number, number, string]>
  r: Array<[number, number, number, number, number]>
}

const loaded = new Map<string, Promise<unknown>>()

/** Same-origin JSON (runtime-cached by the service worker, so books read once work offline). */
function fetchJson<T>(path: string): Promise<T> {
  let request = loaded.get(path)
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}bible/${path}`).then((response) => {
      if (!response.ok) throw new Error(`bible/${path}: HTTP ${response.status}`)
      return response.json()
    })
    // A failed request (offline, before the book was cached) is not remembered.
    request.catch(() => loaded.delete(path))
    loaded.set(path, request)
  }
  return request as Promise<T>
}

export const loadBibleIndex = (translation: BibleTranslation) => fetchJson<BibleIndex>(`${translation}/index.json`)
export const loadBibleBook = (translation: BibleTranslation, book: string) => fetchJson<BibleBook>(`${translation}/${book}.json`)

/** `<translation>.<BOOK>.<index>` — the key of a reading in `bibleReadings`. */
export const readingKey = (translation: BibleTranslation, book: string, index: number) => `${translation}.${book}.${index}`
export const readingTextId = (key: string) => `bible:${key}`

/** The verses of reading `index` of a book. */
export function readingVerses(book: BibleBook, index: number): Verse[] {
  const range = book.r[index]
  if (!range) throw new RangeError(`${book.t}.${book.b}: no reading ${index}`)
  const [fc, fv, tc, tv] = range
  const start = book.v.findIndex(([c, v]) => c === fc && v === fv)
  const end = book.v.findIndex(([c, v]) => c === tc && v === tv)
  return book.v.slice(start, end + 1).map(([c, v, t]) => ({ c, v, t }))
}

export interface BibleReadingInput {
  translation: BibleTranslation
  book: string
  index: number
  /** Shown in the player and the summary, e.g. "Genesis 1:1–19" (localised by the caller). */
  title: string
}

/**
 * Starts a Bible reading: the reading becomes a hidden text (`source: 'bible'`) of its sentences — created
 * once, reused on later starts — and is played as an ordinary run, so the matcher, XP, streaks, goal and
 * the golden quarter-hour all apply.
 */
export async function startBibleReading(input: BibleReadingInput, now = Date.now()): Promise<SessionRun> {
  const { translation, book: code, index, title } = input
  const book = await loadBibleBook(translation, code)
  const verses = readingVerses(book, index)
  const lang = TRANSLATION_LANG[translation]
  const textId = readingTextId(readingKey(translation, code, index))
  await db.transaction('rw', [db.texts, db.segments], async () => {
    if (await db.texts.get(textId)) return
    const body = readingText(verses)
    const text: TextItem = {
      id: textId,
      title,
      type: 'text',
      lang,
      body,
      source: 'bible',
      tags: [],
      archived: false,
      splitMode: 'sentence',
      createdAt: now,
      updatedAt: now,
      bible: { translation, book: code, index, ofBook: book.r.length },
    }
    const segments: Segment[] = readingSegments(body, lang).map((content, order) => ({
      id: `${textId}:${order}`,
      textId,
      order,
      content,
      wordCount: countWords(content),
      archived: false,
    }))
    await db.texts.add(text)
    await db.segments.bulkAdd(segments)
  })
  return startRun({ kind: 'text', textId }, now)
}
