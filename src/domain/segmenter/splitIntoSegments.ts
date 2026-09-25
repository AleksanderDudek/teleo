import type { Lang, SplitMode } from '@/domain/types'
import { ABBREVIATION_DOT_PLACEHOLDER, LIST_MARKER, PROTECTED_ABBREVIATIONS } from './constants'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replaces the dots of protected abbreviations (spec §7.2/2) with a
 * placeholder so the sentence segmenter can't read them as sentence ends.
 * Matching is case-insensitive and requires the abbreviation to stand as its
 * own word — `w.` must not match inside `nowy.` or `krów.`.
 */
function protectAbbreviations(text: string, lang: Lang): string {
  return PROTECTED_ABBREVIATIONS[lang].reduce((acc, abbreviation) => {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(abbreviation)}(?![\\p{L}\\p{N}])`,
      'giu',
    )
    return acc.replace(pattern, (match) => match.replace(/\./g, ABBREVIATION_DOT_PLACEHOLDER))
  }, text)
}

function restoreAbbreviations(text: string): string {
  return text.split(ABBREVIATION_DOT_PLACEHOLDER).join('.')
}

function hasIntlSegmenter(): boolean {
  return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
}

function intlSentenceSplit(text: string, lang: Lang): string[] {
  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' })
  return Array.from(segmenter.segment(text), (part) => part.segment)
}

// Fallback when `Intl.Segmenter` is unavailable (spec §7.2/1): split after a
// terminator, optionally followed by closing quotes/brackets, then
// whitespace, then an uppercase letter or digit, optionally preceded by
// opening quotes/brackets. Only the whitespace itself is matched (via look-
// around), so the terminator/quotes stay with the sentence that just ended.
const FALLBACK_SENTENCE_BOUNDARY =
  /(?<=[.!?…][)\]"'’”»]*)\s+(?=[([„“«"']?[\p{Lu}\p{Nd}])/u

function fallbackSentenceSplit(text: string): string[] {
  return text.split(FALLBACK_SENTENCE_BOUNDARY)
}

function sentencesInParagraph(paragraph: string, lang: Lang): string[] {
  const protectedText = protectAbbreviations(paragraph, lang)
  const raw = hasIntlSegmenter()
    ? intlSentenceSplit(protectedText, lang)
    : fallbackSentenceSplit(protectedText)
  return raw.map((part) => restoreAbbreviations(part).trim()).filter((part) => part.length > 0)
}

// A blank line (`\n\s*\n`) is a hard paragraph boundary even without
// punctuation; a single newline inside a paragraph is just wrapped text.
function splitSentenceMode(body: string, lang: Lang): string[] {
  const paragraphs = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
  const segments: string[] = []
  for (const paragraph of paragraphs) {
    const collapsed = paragraph.replace(/\s+/g, ' ').trim()
    if (collapsed.length === 0) continue
    segments.push(...sentencesInParagraph(collapsed, lang))
  }
  return segments
}

// Alternative mode for lists of affirmations and poems: each non-empty,
// trimmed line is its own segment, with a leading list marker stripped.
function splitLineMode(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter((line) => line.length > 0)
}

/** Splits pasted text into speakable segments (spec §7.2). */
export function splitIntoSegments(body: string, lang: Lang, mode: SplitMode): string[] {
  return mode === 'line' ? splitLineMode(body) : splitSentenceMode(body, lang)
}
