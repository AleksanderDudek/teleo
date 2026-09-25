const COMBINING_MARKS = /\p{M}/gu

/** Shorter words get no fuzzy tolerance: "am"/"an" are different words, not recognition slips. */
const MIN_FUZZY_LENGTH = 4

/**
 * Base letters only (`zażółć` → `zazolc`). Speech recognition often drops Polish
 * diacritics; `ł` has no Unicode decomposition, so it is mapped explicitly.
 */
export function stripDiacritics(word: string): string {
  return word.normalize('NFD').replace(COMBINING_MARKS, '').replaceAll('ł', 'l').replaceAll('Ł', 'L')
}

/** Character edit distance (insert, delete, substitute = 1). */
export function levenshtein(a: string, b: string): number {
  // Single DP row: before the update of cell j, row[j] holds the distance from the previous row.
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = i - 1
    let left = i
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = row[j] ?? 0
      const substitution = diagonal + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1)
      left = Math.min(substitution, up + 1, left + 1)
      row[j] = left
      diagonal = up
    }
  }
  return row[b.length] ?? 0
}

/**
 * `near` = the same word up to diacritics, or (both ≥ 4 letters) a character
 * similarity `1 − distance / longer length` of at least 0.8.
 */
export function compareWords(source: string, spoken: string): 'match' | 'near' | 'none' {
  if (source === spoken) return 'match'
  const a = stripDiacritics(source)
  const b = stripDiacritics(spoken)
  if (a === b) return 'near'
  if (a.length < MIN_FUZZY_LENGTH || b.length < MIN_FUZZY_LENGTH) return 'none'
  const longest = Math.max(a.length, b.length)
  // similarity ≥ 4/5 in integers, so the 0.8 boundary is exact.
  return (longest - levenshtein(a, b)) * 5 >= longest * 4 ? 'near' : 'none'
}
