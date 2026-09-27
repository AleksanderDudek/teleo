import type { Lang } from '@/domain/types'

/**
 * A calm reading-aloud pace. Polish words carry more syllables than English ones, so fewer of them fit in
 * a minute. Used to size Bible readings and to estimate today's reading time from the words said.
 */
export const WORDS_PER_MINUTE: Readonly<Record<Lang, number>> = { en: 140, pl: 110 }

/**
 * Estimated time (ms) it takes to say `words` aloud. An estimate on purpose: it is the same in live and
 * tap mode, does not depend on how a recogniser reports durations, and pauses do not inflate it.
 */
export function readingMs(words: number, lang: Lang): number {
  return Math.round((Math.max(0, words) / WORDS_PER_MINUTE[lang]) * 60_000)
}
