import { describe, expect, it } from 'vitest'
import { BIBLE_BOOKS } from './books'
import { bibleMetrics, nextReading, type BibleReadingLike } from './progress'

const done = (book: string, index: number, ofBook: number, translation = 'kjv'): BibleReadingLike => ({ readingId: `${translation}.${book}.${index}`, translation, book, ofBook })

describe('bibleMetrics', () => {
  it('counts distinct readings and books read to the end in any translation', () => {
    const rows = [done('GEN', 0, 2), done('GEN', 1, 2), done('RUT', 0, 3), done('JUD', 0, 1, 'pbg'), done('JUD', 0, 1, 'pbg')]
    expect(bibleMetrics(rows)).toEqual({ readings: 4, books: 2, oldTestament: 0, newTestament: 0, whole: 0 })
  })

  it('marks a testament and the whole Bible once every book is read', () => {
    const nt = BIBLE_BOOKS.slice(39).map((book) => done(book, 0, 1))
    expect(bibleMetrics(nt)).toMatchObject({ books: 27, newTestament: 1, oldTestament: 0, whole: 0 })
    const all = BIBLE_BOOKS.map((book, i) => done(book, 0, 1, i % 2 ? 'kjv' : 'pbg'))
    expect(bibleMetrics(all)).toMatchObject({ books: 66, oldTestament: 1, newTestament: 1, whole: 1 })
  })
})

describe('nextReading', () => {
  const books = [
    { code: 'GEN', readings: 3 },
    { code: 'EXO', readings: 2 },
  ] as const
  it('starts at the beginning', () => {
    expect(nextReading(books, new Set(), undefined)).toEqual({ book: 'GEN', index: 0 })
  })

  it('continues after the reading finished last, skipping ones already read', () => {
    const read = new Set(['GEN.0', 'GEN.2'])
    expect(nextReading(books, read, { book: 'GEN', index: 0 })).toEqual({ book: 'GEN', index: 1 })
    expect(nextReading(books, new Set(['GEN.2']), { book: 'GEN', index: 2 })).toEqual({ book: 'EXO', index: 0 })
  })

  it('wraps around to readings left behind, and is null when everything is read', () => {
    expect(nextReading(books, new Set(['EXO.0', 'EXO.1', 'GEN.1']), { book: 'EXO', index: 1 })).toEqual({ book: 'GEN', index: 0 })
    expect(nextReading(books, new Set(['GEN.0', 'GEN.1', 'GEN.2', 'EXO.0', 'EXO.1']), { book: 'EXO', index: 1 })).toBeNull()
  })
})
