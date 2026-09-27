/*
 * Splits a book of the Bible into readings of about one minute that always end on a finished sentence.
 * Self-contained (no imports), so `scripts/build-bible.mts` runs the very same function at build time
 * and ships the plan as data: reading ids stay stable.
 */

/** A verse: chapter, verse number, text. */
export interface Verse {
  c: number
  v: number
  t: string
}

/** A reading from verse `from` to verse `to` (inclusive), as `[chapter, verse]`. */
export interface ReadingRange {
  from: [number, number]
  to: [number, number]
  words: number
}

const WORD = /[\p{L}\p{N}]/u
const SENTENCE_END = /[.?!][\s'"’”)\]]*$/u
const CLAUSE_END = /[;:][\s'"’”)\]]*$/u

export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => WORD.test(token)).length
}

/** A chapter end closes a reading once it holds this share of a minute… */
const CHAPTER_CLOSE = 0.6
/** …a sentence still running after this many minutes may close at a `;` or `:`… */
const CLAUSE_CLOSE = 2.5
/** …and after this many, at any verse end. */
const HARD_CLOSE = 4
/** A book's last reading shorter than this share of a minute joins the one before. */
const SHORT_TAIL = 0.4

/**
 * Readings for one book, in order. `targetWords` = the words of one minute of reading aloud.
 * A reading closes at the first sentence end after `targetWords`; a chapter end closes it early once it
 * has 60 % of that (short chapters run on into the next); a runaway sentence may close at a clause end
 * after 2.5 minutes, and anything closes at a verse end after 4. A short last reading joins the previous.
 */
export function planReadings(verses: readonly Verse[], targetWords: number): ReadingRange[] {
  const readings: ReadingRange[] = []
  let from: [number, number] | null = null
  let words = 0
  verses.forEach((verse, i) => {
    from ??= [verse.c, verse.v]
    words += countWords(verse.t)
    const next = verses[i + 1]
    const bookEnd = next === undefined
    const chapterEnd = bookEnd || next.c !== verse.c
    const sentenceEnd = chapterEnd || SENTENCE_END.test(verse.t)
    const close =
      bookEnd ||
      (words >= targetWords && sentenceEnd) ||
      (chapterEnd && words >= CHAPTER_CLOSE * targetWords) ||
      (words >= CLAUSE_CLOSE * targetWords && CLAUSE_END.test(verse.t)) ||
      words >= HARD_CLOSE * targetWords
    if (!close) return
    readings.push({ from, to: [verse.c, verse.v], words })
    from = null
    words = 0
  })
  const last = readings.at(-1)
  const previous = readings.at(-2)
  if (last && previous && last.words < SHORT_TAIL * targetWords) {
    readings.splice(-2, 2, { from: previous.from, to: last.to, words: previous.words + last.words })
  }
  return readings
}
