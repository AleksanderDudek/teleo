import type { BibleMetricsLike } from '@/domain/gamification'
import { BIBLE_BOOKS, OLD_TESTAMENT_BOOKS } from './books'

/** The fields of a finished-reading row that progress needs. */
export interface BibleReadingLike {
  readingId: string
  translation: string
  book: string
  ofBook: number
}

/**
 * Bible challenge metrics: distinct readings, and books read to the end — a book counts once, in whichever
 * translation it was finished; testaments and the whole Bible follow from the books.
 */
export function bibleMetrics(rows: readonly BibleReadingLike[]): BibleMetricsLike {
  const readings = new Set(rows.map((row) => row.readingId))
  const perBook = new Map<string, { read: Set<string>; of: number }>()
  for (const row of rows) {
    const key = `${row.translation}.${row.book}`
    const entry = perBook.get(key) ?? { read: new Set<string>(), of: row.ofBook }
    entry.read.add(row.readingId)
    perBook.set(key, entry)
  }
  const books = new Set<string>()
  for (const [key, { read, of }] of perBook) if (read.size >= of) books.add(key.slice(key.indexOf('.') + 1))
  const all = (codes: readonly string[]) => (codes.every((code) => books.has(code)) ? 1 : 0)
  return {
    readings: readings.size,
    books: books.size,
    oldTestament: all(BIBLE_BOOKS.slice(0, OLD_TESTAMENT_BOOKS)),
    newTestament: all(BIBLE_BOOKS.slice(OLD_TESTAMENT_BOOKS)),
    whole: all(BIBLE_BOOKS),
  }
}

export interface ReadingPosition {
  book: string
  index: number
}

/**
 * The next reading to offer: the first unread one after the reading finished last (reading on through the
 * Bible), wrapping around to any left behind; from the very beginning for a new reader. `read` holds
 * `BOOK.index` keys of one translation. `null` once everything is read.
 */
export function nextReading(
  books: ReadonlyArray<{ code: string; readings: number }>,
  read: ReadonlySet<string>,
  last: ReadingPosition | undefined,
): ReadingPosition | null {
  const order = books.flatMap(({ code, readings }) => Array.from({ length: readings }, (_, index) => ({ book: code, index })))
  const at = last ? order.findIndex((p) => p.book === last.book && p.index === last.index) : -1
  for (let step = 1; step <= order.length; step++) {
    const position = order[(at + step + order.length) % order.length]!
    if (!read.has(`${position.book}.${position.index}`)) return position
  }
  return null
}
