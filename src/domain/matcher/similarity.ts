import type { Lang } from '@/domain/types'

const COMBINING_MARKS = /\p{M}/gu
const DIGITS = /^\d+$/u

/** Shorter words get no fuzzy tolerance: "am"/"an" are different words, not recognition slips. */
const MIN_FUZZY_LENGTH = 4

/**
 * Base letters only (`zażółć` → `zazolc`). Speech recognition often drops Polish
 * diacritics; `ł` has no Unicode decomposition, so it is mapped explicitly.
 */
export function stripDiacritics(word: string): string {
  return word
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replaceAll('ł', 'l')
    .replaceAll('Ł', 'L')
}

/**
 * How a word sounds, for comparing it with a transcript: Polish spellings of one sound are written
 * alike (`ó`→`u`, `rz`→`ż`, `ch`→`h`) before diacritics are dropped, so `Bóg`/`bug`, `morze`/`może` and
 * `chleba`/`hleba` share a key. English keeps its letters: there `ch` and `h` are different sounds.
 * Compare it next to `stripDiacritics`, not instead: a transcript without diacritics (`wiekow`) matches
 * `wieków` only by the bare form.
 */
export function soundKey(word: string, lang: Lang): string {
  const lower = word.toLocaleLowerCase(lang)
  if (lang !== 'pl') return stripDiacritics(lower)
  return stripDiacritics(lower.replaceAll('ó', 'u').replaceAll('rz', 'ż').replaceAll('ch', 'h'))
}

/**
 * Character edit distance (insert, delete, substitute = 1). Once every cell of a
 * row exceeds `cap` the distance must too (values never decrease along a path),
 * so it stops there and returns that row's minimum.
 */
function editDistance(a: string, b: string, cap: number): number {
  // Single DP row: before the update of cell j, row[j] holds the distance from the previous row.
  const row: number[] = []
  for (let j = 0; j <= b.length; j++) row.push(j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = i - 1
    let left = i
    let rowMin = left
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = row[j] ?? 0
      const substitution = diagonal + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)
      left = Math.min(substitution, up + 1, left + 1)
      row[j] = left
      diagonal = up
      rowMin = Math.min(rowMin, left)
    }
    if (rowMin > cap) return rowMin
  }
  return row[b.length] ?? 0
}

export function levenshtein(a: string, b: string): number {
  return editDistance(a, b, Infinity)
}

/**
 * The `near` rule for two words already stripped of diacritics: equal, or both
 * ≥ 4 letters with a similarity `1 − distance / longer length` of at least 0.8,
 * i.e. at most one edit per five letters (integer maths keeps the boundary exact).
 * Numbers get no tolerance: one digit off is a different number, not a slip.
 */
export function isNearMatch(bareSource: string, bareSpoken: string): boolean {
  if (bareSource === bareSpoken) return true
  if (bareSource.length < MIN_FUZZY_LENGTH || bareSpoken.length < MIN_FUZZY_LENGTH) return false
  const maxDistance = Math.floor(Math.max(bareSource.length, bareSpoken.length) / 5)
  // Different words are at least one edit and their length difference apart: no DP when
  // that alone is too much (4-letter words must be equal).
  if (maxDistance === 0 || Math.abs(bareSource.length - bareSpoken.length) > maxDistance) {
    return false
  }
  if (isNumber(bareSource) || isNumber(bareSpoken)) return false
  return editDistance(bareSource, bareSpoken, maxDistance) <= maxDistance
}

/** All digits; the first-character test spares the regex for ordinary words (hot path). */
function isNumber(word: string): boolean {
  const first = word.charCodeAt(0)
  return first >= 48 && first <= 57 && DIGITS.test(word)
}

/** `match` when identical, `near` when only a speech-recognition slip apart, else `none`. */
export function compareWords(source: string, spoken: string): 'match' | 'near' | 'none' {
  if (source === spoken) return 'match'
  return isNearMatch(stripDiacritics(source), stripDiacritics(spoken)) ? 'near' : 'none'
}
