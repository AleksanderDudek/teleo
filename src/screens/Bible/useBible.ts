import type { TFunction } from 'i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '@/db/schema'
import type { BibleReadingRow, SessionRun } from '@/db/types'
import { rangeLabel } from '@/domain/bible/label'
import { nextReading, type ReadingPosition } from '@/domain/bible/progress'
import { LANG_TRANSLATION, type BibleTranslation } from '@/domain/bible/types'
import { loadBibleBook, loadBibleIndex, startBibleReading, type BibleBook, type BibleIndex } from '@/services/bible'
import { useSettingsStore } from '@/stores/settings'

/** The translation of the challenge: the one in the interface language (one language at a time). */
export function useBibleTranslation(): BibleTranslation {
  return LANG_TRANSLATION[useSettingsStore((s) => s.app.uiLang)]
}

type Loaded<T> = { data?: T; error: boolean }

/** A Bible file loaded once (fetch cache + service-worker cache); `error` when offline and not cached. */
function useLoaded<T>(load: (() => Promise<T>) | null, key: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T> & { key?: string }>({ error: false })
  useEffect(() => {
    if (!load) return
    let live = true
    load().then(
      (data) => live && setState({ data, error: false, key }),
      () => live && setState({ error: true, key }),
    )
    return () => {
      live = false
    }
    // `key` identifies the request; `load` is a new closure each render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? state : { error: false }
}

export const useBibleIndex = (translation: BibleTranslation) => useLoaded(() => loadBibleIndex(translation), `index:${translation}`)
export const useBibleBook = (translation: BibleTranslation, book: string | undefined) =>
  useLoaded(book ? () => loadBibleBook(translation, book) : null, `book:${translation}:${book ?? ''}`)

/** Finished readings of a translation, kept live. */
export function useBibleReadings(translation: BibleTranslation): BibleReadingRow[] | undefined {
  return useLiveQuery(() => db.bibleReadings.filter((row) => row.translation === translation).toArray(), [translation])
}

export interface BibleSummary {
  done: number
  total: number
  share: number
  next: ReadingPosition | null
  /** Days left at 15 minutes a day. */
  daysLeft: number
  read: ReadonlySet<string>
}

export function bibleSummary(index: BibleIndex, rows: readonly BibleReadingRow[]): BibleSummary {
  const read = new Set(rows.map((row) => `${row.book}.${row.index}`))
  const last = [...rows].sort((a, b) => b.completedAt - a.completedAt)[0]
  const done = read.size
  const share = index.readings ? done / index.readings : 0
  const remainingWords = index.words * (1 - share)
  return {
    done,
    total: index.readings,
    share,
    next: nextReading(
      index.books.map((b) => ({ code: b.b, readings: b.readings })),
      read,
      last ? { book: last.book, index: last.index } : undefined,
    ),
    daysLeft: Math.ceil(remainingWords / (index.wordsPerMinute * 15)),
    read,
  }
}

export function bookName(t: TFunction, code: string): string {
  return (t as unknown as (key: string) => string)(`bible.books.${code}`)
}

/** "Genesis 1:1–19" in the interface language. */
export function readingTitle(t: TFunction, book: BibleBook, index: number): string {
  const range = book.r[index]
  if (!range) return bookName(t, book.b)
  const [fc, fv, tc, tv] = range
  const lastVerse = Math.max(...book.v.filter(([c]) => c === fc).map(([, v]) => v))
  return t('bible.reference', { book: bookName(t, book.b), range: rangeLabel([fc, fv], [tc, tv], lastVerse) })
}

/** Reading time of a reading, whole minutes (at least 1). */
export function readingMinutes(book: BibleBook, index: number, wordsPerMinute: number): number {
  return Math.max(1, Math.round((book.r[index]?.[4] ?? 0) / wordsPerMinute))
}

export async function startReading(t: TFunction, translation: BibleTranslation, bookCode: string, index: number): Promise<SessionRun> {
  const book = await loadBibleBook(translation, bookCode)
  return startBibleReading({ translation, book: bookCode, index, title: readingTitle(t, book, index) })
}

/** Starts the next reading of the challenge (after a finished one); `null` when all are read. */
export async function startNextReading(t: TFunction, translation: BibleTranslation): Promise<SessionRun | null> {
  const [index, rows] = await Promise.all([loadBibleIndex(translation), db.bibleReadings.filter((r) => r.translation === translation).toArray()])
  const next = bibleSummary(index, rows).next
  return next ? startReading(t, translation, next.book, next.index) : null
}

/** Share of the whole Bible read aloud in the current translation; `undefined` before the first reading. */
export function useBibleShare(): number | undefined {
  const translation = useBibleTranslation()
  const rows = useBibleReadings(translation)
  const index = useBibleIndex(translation)
  if (!rows?.length || !index.data) return undefined
  return bibleSummary(index.data, rows).share
}
