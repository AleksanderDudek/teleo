import type { Lang } from '@/domain/types'

/** Hard cap on segments per text; blocks saving above this (spec §7.2/6). */
export const MAX_SEGMENTS_PER_TEXT = 150

/** Hard cap on words per segment; blocks saving above this (spec §7.2/4,6). */
export const MAX_WORDS_PER_SEGMENT = 80

/** Segments longer than this get a non-blocking split suggestion (spec §7.2/4). */
export const LONG_SEGMENT_WORDS = 40

/** Segments shorter than this get a merge suggestion (spec §7.2/5). */
export const SHORT_SEGMENT_WORDS = 3

/**
 * Placeholder that stands in for the dot of a protected abbreviation while the
 * sentence segmenter runs. U+E000 (private-use area) — NOT U+2024 (ONE DOT
 * LEADER), which ICU's `Intl.Segmenter` still treats as a sentence terminator.
 */
export const ABBREVIATION_DOT_PLACEHOLDER = '\uE000'

/**
 * Whole-word abbreviations whose trailing dot must not be read as a sentence
 * end (spec §7.2/2). Matching is case-insensitive; only the list for the
 * text's own language applies.
 */
export const PROTECTED_ABBREVIATIONS: Readonly<Record<Lang, readonly string[]>> = {
  pl: ['np.', 'itd.', 'itp.', 'tzn.', 'św.', 'ks.', 'dr.', 'prof.', 'r.', 'w.'],
  en: ['Mr.', 'Mrs.', 'Dr.', 'St.', 'e.g.', 'i.e.', 'vs.'],
}

/**
 * List markers stripped from the start of a line in line mode (spec §7.2/3):
 * bullet characters, or 1–3 digits followed by `.` or `)`, then whitespace —
 * or end of line, so a line holding only a marker reduces to empty.
 */
export const LIST_MARKER = /^(?:[-*•·–—]|\d{1,3}[.)])(?:\s+|$)/
