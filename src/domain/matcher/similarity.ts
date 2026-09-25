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
 * The `near` rule for two words already stripped of diacritics: equal, or both
 * ≥ 4 letters with a similarity `1 − distance / longer length` of at least 0.8.
 * Numbers get no tolerance: one digit off is a different number, not a slip.
 */
export function isNearMatch(bareSource: string, bareSpoken: string): boolean {
  if (bareSource === bareSpoken) return true
  if (DIGITS.test(bareSource) || DIGITS.test(bareSpoken)) return false
  if (bareSource.length < MIN_FUZZY_LENGTH || bareSpoken.length < MIN_FUZZY_LENGTH) return false
  const longest = Math.max(bareSource.length, bareSpoken.length)
  // similarity ≥ 4/5 in integers, so the 0.8 boundary is exact.
  const similarEnough = (distance: number) => (longest - distance) * 5 >= longest * 4
  // The distance is at least the length difference: skip the DP when that alone is too much.
  return (
    similarEnough(Math.abs(bareSource.length - bareSpoken.length)) &&
    similarEnough(levenshtein(bareSource, bareSpoken))
  )
}

/** `match` when identical, `near` when only a speech-recognition slip apart, else `none`. */
export function compareWords(source: string, spoken: string): 'match' | 'near' | 'none' {
  if (source === spoken) return 'match'
  return isNearMatch(stripDiacritics(source), stripDiacritics(spoken)) ? 'near' : 'none'
}
