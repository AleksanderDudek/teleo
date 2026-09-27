import { LONG_SEGMENT_WORDS, splitIntoSegments, suggestSplitPoint } from '@/domain/segmenter'
import type { Lang } from '@/domain/types'
import { countWords, type Verse } from './readings'

/** The words of a reading, verse after verse (verse numbers are never spoken). */
export function readingText(verses: readonly Verse[]): string {
  return verses
    .map((verse) => verse.t.trim())
    .filter(Boolean)
    .join(' ')
}

/** Halves a sentence at the clause nearest its middle until every part is short enough to say at once. */
function splitLong(sentence: string): string[] {
  if (countWords(sentence) <= LONG_SEGMENT_WORDS) return [sentence]
  const point = suggestSplitPoint(sentence)
  if (point === null) return [sentence]
  const words = sentence.trim().split(/\s+/)
  return [...splitLong(words.slice(0, point).join(' ')), ...splitLong(words.slice(point).join(' '))]
}

/**
 * The sentences of a reading as practice segments: sentence by sentence (across verse boundaries), long
 * ones split at `;`/`:`/`,` near the middle (spec §7.2) so the recogniser gets one breath at a time.
 */
export function readingSegments(text: string, lang: Lang): string[] {
  return splitIntoSegments(text, lang, 'sentence').flatMap(splitLong)
}
