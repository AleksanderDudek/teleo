import { countWords } from '@/domain/text/countWords'
import {
  LONG_SEGMENT_WORDS,
  MAX_SEGMENTS_PER_TEXT,
  MAX_WORDS_PER_SEGMENT,
  SHORT_SEGMENT_WORDS,
} from './constants'

export type SegmentIssue =
  | { kind: 'long'; index: number; words: number; suggestedSplitWord: number | null }
  | { kind: 'tooLong'; index: number; words: number; suggestedSplitWord: number | null }
  | { kind: 'short'; index: number; words: number; mergeWith: 'previous' | 'next' }
  | { kind: 'digits'; index: number }
  | { kind: 'tooMany'; count: number }

/** Word index of the nearest `;`/`:`/`,` to the middle of `words`, or `null` if none carry it. */
function nearestMiddleCandidate(words: readonly string[], marks: readonly string[]): number | null {
  const middle = words.length / 2
  const candidates = words
    .slice(0, -1) // a mark on the very last word leaves nothing to split off
    .flatMap((word, i) => (marks.some((mark) => word.includes(mark)) ? [i + 1] : []))
  if (candidates.length === 0) return null
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - middle) < Math.abs(best - middle) ? candidate : best,
  )
}

/**
 * Word index where a second part would start if `segment` were split there
 * (spec §7.2/4): after the `;`/`:` nearest the middle when there is one,
 * else after the `,` nearest the middle, else at the middle word boundary.
 * `null` for segments with fewer than two words, which can't be split.
 */
export function suggestSplitPoint(segment: string): number | null {
  const words = segment.trim().split(/\s+/)
  if (words.length < 2) return null

  return (
    nearestMiddleCandidate(words, [';', ':']) ??
    nearestMiddleCandidate(words, [',']) ??
    Math.round(words.length / 2)
  )
}

const HAS_DIGIT = /\p{Nd}/u

/**
 * Flags segments that need attention before a text can be saved (spec §7.2):
 * too long/short, containing digits, or the text having too many segments.
 * Ordered by segment index, with `tooMany` first.
 */
export function analyzeSegments(segments: readonly string[]): SegmentIssue[] {
  const issues: SegmentIssue[] = []

  if (segments.length > MAX_SEGMENTS_PER_TEXT) {
    issues.push({ kind: 'tooMany', count: segments.length })
  }

  segments.forEach((segment, index) => {
    const wordCount = countWords(segment)

    if (wordCount > MAX_WORDS_PER_SEGMENT) {
      issues.push({
        kind: 'tooLong',
        index,
        words: wordCount,
        suggestedSplitWord: suggestSplitPoint(segment),
      })
    } else if (wordCount > LONG_SEGMENT_WORDS) {
      issues.push({
        kind: 'long',
        index,
        words: wordCount,
        suggestedSplitWord: suggestSplitPoint(segment),
      })
    }

    if (wordCount < SHORT_SEGMENT_WORDS && segments.length > 1) {
      issues.push({ kind: 'short', index, words: wordCount, mergeWith: index === 0 ? 'next' : 'previous' })
    }

    if (HAS_DIGIT.test(segment)) {
      issues.push({ kind: 'digits', index })
    }
  })

  return issues
}
