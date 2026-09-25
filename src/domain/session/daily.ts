import { MAX_SESSION_SEGMENTS } from './types'

interface DailyCandidate {
  id: string
  segmentCount: number
  lastPracticedAt?: number
}

/**
 * Picks the "session of the day": texts not yet practiced today, oldest
 * (or never-practiced) first, added until `targetSegments` is reached. A
 * candidate that would push the running total past `MAX_SESSION_SEGMENTS`
 * is skipped in favor of a later, smaller one — except the very first pick,
 * which is always taken so the result is never empty while a candidate
 * remains (expansion will flag `overLimit` if it alone is oversized).
 */
export function pickDailyTexts(input: {
  candidates: ReadonlyArray<DailyCandidate>
  practicedToday: ReadonlySet<string>
  targetSegments: number
}): string[] {
  const ordered = input.candidates
    .filter((c) => c.segmentCount > 0 && !input.practicedToday.has(c.id))
    .sort((a, b) => {
      if (a.lastPracticedAt === undefined && b.lastPracticedAt === undefined) return 0
      if (a.lastPracticedAt === undefined) return -1
      if (b.lastPracticedAt === undefined) return 1
      return a.lastPracticedAt - b.lastPracticedAt
    })

  const result: string[] = []
  let total = 0

  for (const candidate of ordered) {
    const isFirst = result.length === 0
    if (!isFirst && total >= input.targetSegments) break
    if (!isFirst && total + candidate.segmentCount > MAX_SESSION_SEGMENTS) continue
    result.push(candidate.id)
    total += candidate.segmentCount
  }

  return result
}
