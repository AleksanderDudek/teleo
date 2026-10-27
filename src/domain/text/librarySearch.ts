import { searchKey } from '@/lib/search'

/*
 * Library search (DECISIONS #130): every word of the query must start a word of the text, in any order; a match in the
 * title counts most, then in what the text is prayed for (need and area labels), its tags and its words. Long words are
 * also tried one or two letters shorter, so one Polish form finds another ("długi" finds "długów"). Pure module.
 */

/** What a text is searched by; `labels` are the names of its needs and their areas in the interface language. */
export interface SearchFields {
  title: string
  labels: readonly string[]
  tags: readonly string[]
  body: string
}

/** Each field folded once into ` word word … ` (a space on both sides), so "starts a word" is one `includes`. */
export interface SearchIndex {
  title: string
  labels: string
  tags: string
  body: string
}

const WEIGHTS = { title: 8, labels: 4, tags: 2, body: 1 } as const
/** A word reached only through its shortened form counts a little less than one that starts as typed. */
const STEM_FACTOR = 0.5
/** Saying a word more often lifts a text a little — never above a match in a tag. */
const REPEAT_BONUS = 0.25
const MAX_REPEATS = 3

const words = (value: string) => ` ${searchKey(value).split(/[^\p{L}]+/u).filter(Boolean).join(' ')} `

export const indexForSearch = (fields: SearchFields): SearchIndex => ({
  title: words(fields.title),
  labels: words(fields.labels.join(' ')),
  tags: words(fields.tags.join(' ')),
  body: words(fields.body),
})

/** The words of a query, folded and once each. */
export const searchTerms = (query: string): string[] => [...new Set(words(query).trim().split(' ').filter(Boolean))]

/** A term as typed, then one letter shorter from five letters and two shorter from seven — never under four. */
function stems(term: string): string[] {
  const out = [term]
  if (term.length >= 5) out.push(term.slice(0, -1))
  if (term.length >= 7) out.push(term.slice(0, -2))
  return out
}

function occurrences(field: string, prefix: string): number {
  let count = 0
  for (let at = field.indexOf(prefix); at !== -1 && count <= MAX_REPEATS; at = field.indexOf(prefix, at + 1)) count++
  return count
}

function fieldScore(field: string, term: string): number {
  for (const [rank, stem] of stems(term).entries()) {
    const count = occurrences(field, ` ${stem}`)
    if (count > 0) return (rank === 0 ? 1 : STEM_FACTOR) * (1 + REPEAT_BONUS * (Math.min(count, MAX_REPEATS) - 1))
  }
  return 0
}

/** How well a text answers the query: 0 when a word is missing anywhere, higher for better places; 1 for no query. */
export function searchScore(index: SearchIndex, terms: readonly string[]): number {
  let total = 0
  for (const term of terms) {
    let score = 0
    for (const field of Object.keys(WEIGHTS) as (keyof SearchIndex)[]) {
      // Only the words count repeats: a title or a tag says a word once however it is written.
      const value = fieldScore(index[field], term)
      score += WEIGHTS[field] * (field === 'body' ? value : Math.min(value, 1))
    }
    if (score === 0) return 0
    total += score
  }
  return terms.length === 0 ? 1 : total
}

/** The items that answer the query, best first; equals keep the order they came in (the caller's own sort). */
export function rankBySearch<T>(items: readonly T[], terms: readonly string[], indexOf: (item: T) => SearchIndex | undefined): T[] {
  if (terms.length === 0) return [...items]
  return items
    .map((item, order) => ({ item, order, score: searchScore(indexOf(item) ?? indexForSearch(EMPTY), terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.item)
}

const EMPTY: SearchFields = { title: '', labels: [], tags: [], body: '' }
