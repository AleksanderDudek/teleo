/** One recognition result: its alternatives (best first) and whether it is final. */
export interface ResultSnapshot {
  alternatives: string[]
  isFinal: boolean
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * WebKit (Safari) sometimes reports cumulative results in continuous mode:
 * a later result repeats the earlier one and extends it. Keeping both would
 * look like the user repeated words (→ "extra word" rejections), so an earlier
 * result that a later one strictly extends is dropped. Only applied on WebKit —
 * elsewhere two identical results mean a genuine repetition.
 */
export function collapseCumulative(results: readonly ResultSnapshot[]): ResultSnapshot[] {
  const kept: ResultSnapshot[] = []
  for (const result of results) {
    const text = clean(result.alternatives[0] ?? '').toLowerCase()
    const previous = kept.at(-1)
    const previousText = clean(previous?.alternatives[0] ?? '').toLowerCase()
    if (previous && previousText && text.length > previousText.length && text.startsWith(previousText)) kept.pop()
    kept.push(result)
  }
  return kept
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
