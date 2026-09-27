/**
 * A reading's verses as people write them: `1:1–19`, `1:28–2:3`, `5:4`; a whole single chapter as `1`
 * (pass the chapter's verse count as `lastVerseOfChapter`).
 */
export function rangeLabel(from: readonly [number, number], to: readonly [number, number], lastVerseOfChapter?: number): string {
  const [fc, fv] = from
  const [tc, tv] = to
  if (fc === tc && fv === 1 && tv === lastVerseOfChapter) return String(fc)
  if (fc !== tc) return `${fc}:${fv}–${tc}:${tv}`
  return fv === tv ? `${fc}:${fv}` : `${fc}:${fv}–${tv}`
}
