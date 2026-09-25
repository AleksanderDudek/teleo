import { countWords } from '@/domain/text/countWords'
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
 * Throws if either resulting part would have no real words (spec's
 * `countWords`), e.g. splitting off a bare punctuation mark like `—`.
 */
export function splitSegmentAt(
  segments: readonly string[],
  index: number,
  wordIndex: number,
): string[] {
  const segment = requireSegment(segments, index)
  if (!Number.isInteger(wordIndex)) {
    throw new RangeError(`Word index must be an integer: ${wordIndex}`)
  }

  const words = segment.trim().split(/\s+/)
  if (wordIndex <= 0 || wordIndex >= words.length) {
    throw new RangeError(`Word index out of range: ${wordIndex}`)
  }

  const part1 = words.slice(0, wordIndex).join(' ')
  const part2 = words.slice(wordIndex).join(' ')
  if (countWords(part1) === 0 || countWords(part2) === 0) {
    throw new RangeError(`Split at word index ${wordIndex} would leave a part with no words`)
  }

  const result = [...segments]
  result.splice(index, 1, part1, part2)
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
 * Replaces the segment at `index` with `content` — newlines and whitespace
 * runs collapsed to a single space, then trimmed, since a segment is always
 * a single line — or removes it when that leaves nothing. Pure: `segments`
 * is left untouched.
 */
export function replaceSegment(
  segments: readonly string[],
  index: number,
  content: string,
): string[] {
  requireSegment(segments, index)
  const normalized = content.replace(/\s+/g, ' ').trim()

  const result = [...segments]
  if (normalized === '') {
    result.splice(index, 1)
  } else {
    result.splice(index, 1, normalized)
  }
  return result
}

/** Whether an issue blocks saving the text (spec §7.2/4,6). */
export function isBlocking(issue: SegmentIssue): boolean {
  return issue.kind === 'tooLong' || issue.kind === 'tooMany'
}
