// Builds public/bible/<translation>/{index,<BOOK>}.json from public-domain Bible texts.
// Run: `npm run bible` (outputs are committed). Sources: scrollmapper/bible_databases (JSON), cached in
// node_modules/.cache/teleo-bible. The reading plan comes from src/domain/bible/readings.ts — the same
// tested function the app documents — so reading ids are stable data, not recomputed at runtime.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { BIBLE_BOOKS } from '../src/domain/bible/books.ts'
import { countWords, planReadings, type Verse } from '../src/domain/bible/readings.ts'
import { WORDS_PER_MINUTE } from '../src/domain/reading/pace.ts'

const SOURCE = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/'
const CACHE = new URL('../node_modules/.cache/teleo-bible/', import.meta.url)
const OUT = new URL('../public/bible/', import.meta.url)

interface SourceFile {
  books: Array<{ name: string; chapters: Array<{ chapter: number; verses: Array<{ verse: number; text: string }> }> }>
}

const TRANSLATIONS = {
  kjv: {
    lang: 'en',
    file: 'KJVPCE.json',
    // The PCE file has a few empty verses; the same (public-domain) words are taken from the 1769 KJV file.
    backfill: 'KJV.json',
    name: 'King James Version (Pure Cambridge Edition)',
  },
  pbg: { lang: 'pl', file: 'PolGdanska.json', backfill: undefined, name: 'Biblia Gdańska (1881)' },
} as const

async function source(file: string): Promise<SourceFile> {
  const cached = new URL(file, CACHE)
  try {
    return JSON.parse(await readFile(cached, 'utf8')) as SourceFile
  } catch {
    const response = await fetch(`${SOURCE}${file}`)
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
    const text = await response.text()
    await mkdir(CACHE, { recursive: true })
    await writeFile(cached, text)
    return JSON.parse(text) as SourceFile
  }
}

/** Pilcrows and the odd editorial bracket are not spoken; whitespace is normalised. */
function clean(text: string): string {
  return text.replaceAll('¶', '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
}

/** Divine names that are printed in capitals throughout, not only at a chapter start. */
const CAPITAL_NAMES = new Set(['LORD', 'GOD', 'JEHOVAH', 'JAH'])

/** Chapter openings are set in capitals ("IN the beginning", "…of David. HEAR me"); read them as ordinary words. */
function chapterOpening(text: string): string {
  return text.replace(/(?<![\p{L}])\p{Lu}{2,}(?![\p{L}])/gu, (word) => (CAPITAL_NAMES.has(word) ? word : word[0] + word.slice(1).toLowerCase()))
}

for (const [code, spec] of Object.entries(TRANSLATIONS)) {
  const main = await source(spec.file)
  const backfill = spec.backfill ? await source(spec.backfill) : undefined
  if (main.books.length !== BIBLE_BOOKS.length) throw new Error(`${code}: ${main.books.length} books`)
  const wpm = WORDS_PER_MINUTE[spec.lang]
  const dir = new URL(`${code}/`, OUT)
  await mkdir(dir, { recursive: true })
  const books = []
  let skipped = 0
  let filled = 0
  for (const [i, book] of main.books.entries()) {
    const bookCode = BIBLE_BOOKS[i]!
    const verses: Verse[] = []
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        let text = clean(verse.text)
        if (!text && backfill) {
          const other = backfill.books[i]?.chapters.find((c) => c.chapter === chapter.chapter)?.verses.find((v) => v.verse === verse.verse)
          text = clean(other?.text ?? '')
          if (text) filled++
        }
        // Empty verses are versification gaps (merged into a neighbour in this edition).
        if (!text) {
          skipped++
          continue
        }
        verses.push({ c: chapter.chapter, v: verse.verse, t: verse.verse === 1 ? chapterOpening(text) : text })
      }
    }
    const readings = planReadings(verses, wpm)
    const words = verses.reduce((sum, verse) => sum + countWords(verse.t), 0)
    await writeFile(
      new URL(`${bookCode}.json`, dir),
      JSON.stringify({
        t: code,
        b: bookCode,
        v: verses.map((verse) => [verse.c, verse.v, verse.t]),
        r: readings.map((r) => [...r.from, ...r.to, r.words]),
      }),
    )
    books.push({ b: bookCode, chapters: book.chapters.length, words, readings: readings.length })
  }
  const index = {
    translation: code,
    lang: spec.lang,
    name: spec.name,
    license: 'Public domain',
    source: 'https://github.com/scrollmapper/bible_databases',
    wordsPerMinute: wpm,
    readings: books.reduce((sum, b) => sum + b.readings, 0),
    words: books.reduce((sum, b) => sum + b.words, 0),
    books,
  }
  await writeFile(new URL('index.json', dir), `${JSON.stringify(index, null, 1)}\n`)
  console.log(`${code}: ${index.readings} readings, ${index.words} words, ${skipped} empty verses skipped, ${filled} backfilled`)
}
