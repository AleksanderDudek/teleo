/** One recognition result: its alternatives (best first) and whether it is final. */
export interface ResultSnapshot {
  alternatives: string[]
  isFinal: boolean
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

/** A result's best hypothesis as comparable words: lower case, punctuation dropped. */
const wordsOf = (result: ResultSnapshot | undefined) =>
  (result?.alternatives[0] ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

const startsWith = (words: readonly string[], prefix: readonly string[]) => prefix.every((word, i) => words[i] === word)

/** `later` repeats all of `earlier` and adds to it. */
const grows = (earlier: readonly string[], later: readonly string[]) =>
  earlier.length > 0 && later.length > earlier.length && startsWith(later, earlier)

/** `later` repeats `earlier` with its last words revised ("w niebie" → "w niebiesiech"), never shorter. */
function revises(earlier: readonly string[], later: readonly string[]): boolean {
  const kept = earlier.length - Math.max(1, Math.floor(earlier.length / 4))
  return kept >= 2 && later.length >= earlier.length && startsWith(later, earlier.slice(0, kept))
}

/**
 * Some recognisers report one utterance cumulatively in continuous mode: WebKit (Safari, every iOS browser) and the
 * Chrome-family recognisers on Android, which add a new — often already final — result for every growth step
 * ("Jestem", "Jestem spokojny", "Jestem spokojny i pewny"), and may send a shorter or revised copy late. Joining them
 * would look like the user repeated words (→ "extra word" rejections), so each result that grows or revises the one
 * before replaces it, and one that repeats or shortens it is dropped. Apply it only to such recognisers: elsewhere
 * two identical results mean a genuine repetition.
 */
export function collapseCumulative(results: readonly ResultSnapshot[]): ResultSnapshot[] {
  const kept: ResultSnapshot[] = []
  for (const result of results) {
    const words = wordsOf(result)
    const previous = wordsOf(kept.at(-1))
    if (previous.length > 0 && words.length <= previous.length && startsWith(previous, words)) continue
    if (grows(previous, words) || revises(previous, words)) kept.pop()
    kept.push(result)
  }
  return kept
}

/**
 * Whether a result list shows cumulative reporting: three results in a row, each growing the one before. A speaker
 * who starts a sentence again makes one such step at most; a recogniser that reports cumulatively makes one per word.
 */
export function showsGrowth(results: readonly ResultSnapshot[]): boolean {
  let chain = 0
  for (let i = 1; i < results.length; i++) {
    chain = grows(wordsOf(results[i - 1]), wordsOf(results[i])) ? chain + 1 : 0
    if (chain >= 2) return true
  }
  return false
}

/** Best transcript: first alternative of every result, joined. */
export function bestTranscript(results: readonly ResultSnapshot[]): string {
  return clean(results.map((r) => r.alternatives[0] ?? '').join(' '))
}

/**
 * Up to `max` whole-utterance alternatives: the best transcript, then variants
 * swapping in the k-th hypothesis of the LAST result (where recognisers are
 * least certain). Duplicates and empty strings removed.
 */
export function transcriptAlternatives(results: readonly ResultSnapshot[], max = 3): string[] {
  if (results.length === 0) return []
  const head = results.slice(0, -1).map((r) => r.alternatives[0] ?? '')
  const last = results.at(-1)?.alternatives ?? []
  const variants = [bestTranscript(results)]
  for (let k = 1; k < Math.min(max, last.length); k++) variants.push(clean([...head, last[k] ?? ''].join(' ')))
  return [...new Set(variants)].filter(Boolean)
}
