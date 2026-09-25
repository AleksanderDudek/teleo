import type { SegmentIssue } from './analyze'

/** Returns `segments[index]`, throwing `RangeError` if it doesn't exist. */
function requireSegment(segments: readonly string[], index: number): string {
  const segment = segments[index]
  if (segment === undefined) throw new RangeError(`Segment index out of range: ${index}`)
  return segment
}

/**
 * Splits the segment at `index` into two, breaking before word `wordIndex`
 * (1..word count − 1) of its trimmed text. Pure: `segments` is left untouched.
 */
export function splitSegmentAt(
  segments: readonly string[],
  index: number,
  wordIndex: number,
): string[] {
  const segment = requireSegment(segments, index)
  const words = segment.trim().split(/\s+/)
  if (wordIndex <= 0 || wordIndex >= words.length) {
    throw new RangeError(`Word index out of range: ${wordIndex}`)
  }

  const result = [...segments]
  result.splice(index, 1, words.slice(0, wordIndex).join(' '), words.slice(wordIndex).join(' '))
  return result
}

/**
 * Joins the segment at `index` with the one after it, with a single space
 * between. Pure: `segments` is left untouched. Throws for the last index.
 */
export function mergeWithNext(segments: readonly string[], index: number): string[] {
  const current = requireSegment(segments, index)
  const next = requireSegment(segments, index + 1)

  const result = [...segments]
  result.splice(index, 2, `${current} ${next}`)
  return result
}

/**
 * Replaces the segment at `index` with trimmed `content`, or removes it when
 * `content` is empty after trimming. Pure: `segments` is left untouched.
 */
export function replaceSegment(
  segments: readonly string[],
  index: number,
  content: string,
): string[] {
  requireSegment(segments, index)
  const trimmed = content.trim()

  const result = [...segments]
  if (trimmed === '') {
    result.splice(index, 1)
  } else {
    result.splice(index, 1, trimmed)
  }
  return result
}

/** Whether an issue blocks saving the text (spec §7.2/4,6). */
export function isBlocking(issue: SegmentIssue): boolean {
  return issue.kind === 'tooLong' || issue.kind === 'tooMany'
}
