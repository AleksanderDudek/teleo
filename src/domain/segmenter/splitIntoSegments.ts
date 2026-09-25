import { countWords } from '@/domain/text/countWords'
import type { Lang, SplitMode } from '@/domain/types'
import { ABBREVIATION_DOT_PLACEHOLDER, LIST_MARKER, PROTECTED_ABBREVIATIONS } from './constants'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// One whole-word, case-insensitive regex per protected abbreviation, built
// once per language rather than on every call — the editor re-splits the
// text on every keystroke.
function buildAbbreviationPatterns(lang: Lang): RegExp[] {
  return PROTECTED_ABBREVIATIONS[lang].map(
    (abbreviation) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(abbreviation)}(?![\\p{L}\\p{N}])`, 'giu'),
  )
}

const ABBREVIATION_PATTERNS: Record<Lang, readonly RegExp[]> = {
  pl: buildAbbreviationPatterns('pl'),
  en: buildAbbreviationPatterns('en'),
}

/**
 * Replaces the dots of protected abbreviations (spec §7.2/2) with a
 * placeholder so the sentence segmenter can't read them as sentence ends.
 * Matching is case-insensitive and requires the abbreviation to stand as its
 * own word — `w.` must not match inside `nowy.` or `krów.`.
 */
function protectAbbreviations(text: string, lang: Lang): string {
  return ABBREVIATION_PATTERNS[lang].reduce(
    (acc, pattern) => acc.replace(pattern, (match) => match.replace(/\./g, ABBREVIATION_DOT_PLACEHOLDER)),
    text,
  )
}

function restoreAbbreviations(text: string): string {
  return text.split(ABBREVIATION_DOT_PLACEHOLDER).join('.')
}

// If the pasted text already contains our own placeholder character (however
// unlikely), it must not be corrupted into '.' by `restoreAbbreviations`, nor
// treated as one of our own protected dots. Move any pre-existing occurrence
// to a second, distinct private-use character before we touch anything, and
// move it back once we're done — so it round-trips completely unchanged.
const SHIELDED_PLACEHOLDER = '\uE001'

function shieldExistingPlaceholders(text: string): string {
  return text.split(ABBREVIATION_DOT_PLACEHOLDER).join(SHIELDED_PLACEHOLDER)
}

function unshieldExistingPlaceholders(text: string): string {
  return text.split(SHIELDED_PLACEHOLDER).join(ABBREVIATION_DOT_PLACEHOLDER)
}

function hasIntlSegmenter(): boolean {
  return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
}

// One Intl.Segmenter per language, reused across calls — constructing it
// compiles ICU break rules, and the editor re-splits the text on every
// keystroke.
const segmenterCache = new Map<Lang, Intl.Segmenter>()

function getSentenceSegmenter(lang: Lang): Intl.Segmenter {
  const cached = segmenterCache.get(lang)
  if (cached) return cached
  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' })
  segmenterCache.set(lang, segmenter)
  return segmenter
}

function intlSentenceSplit(text: string, lang: Lang): string[] {
  return Array.from(getSentenceSegmenter(lang).segment(text), (part) => part.segment)
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

// ICU's sentence break does not treat a bare `…` as a terminator, so
// `Intl.Segmenter` keeps 'Oddycham spokojnie… Jestem tutaj.' as one sentence.
// Apply the same boundary rule as the fallback, but scoped to `…` only, as a
// post-process after either path (a no-op on fallback output, which already
// split there since `…` is one of its terminators).
const ELLIPSIS_BOUNDARY = /(?<=…[)\]"'’”»]*)\s+(?=[([„“«"']?[\p{Lu}\p{Nd}])/u

function splitAtBareEllipsis(text: string): string[] {
  return text.split(ELLIPSIS_BOUNDARY)
}

function sentencesInParagraph(paragraph: string, lang: Lang): string[] {
  const protectedText = protectAbbreviations(paragraph, lang)
  const raw = (
    hasIntlSegmenter() ? intlSentenceSplit(protectedText, lang) : fallbackSentenceSplit(protectedText)
  ).flatMap(splitAtBareEllipsis)
  return raw
    .map((part) => unshieldExistingPlaceholders(restoreAbbreviations(part)).trim())
    .filter((part) => part.length > 0)
}

// A blank line (`\n\s*\n`) is a hard paragraph boundary even without
// punctuation; a single newline inside a paragraph is just wrapped text.
function splitSentenceMode(body: string, lang: Lang): string[] {
  const shielded = shieldExistingPlaceholders(body).replace(/\r\n?/g, '\n')
  const paragraphs = shielded.split(/\n\s*\n/)
  const segments: string[] = []
  for (const paragraph of paragraphs) {
    const collapsed = paragraph.replace(/\s+/g, ' ').trim()
    if (collapsed.length === 0) continue
    segments.push(...sentencesInParagraph(collapsed, lang))
  }
  return segments
}

// Alternative mode for lists of affirmations and poems: each non-empty,
// trimmed line is its own segment, with a leading list marker stripped and
// internal whitespace runs collapsed to a single space.
function splitLineMode(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(LIST_MARKER, '').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
}

/** Splits pasted text into speakable segments (spec §7.2). */
export function splitIntoSegments(body: string, lang: Lang, mode: SplitMode): string[] {
  // NFC first: a decomposed letter (e.g. "ó" as o + combining acute) isn't
  // `\p{L}` on its own, which would fool the abbreviation word-boundary check.
  const normalized = body.normalize('NFC')
  const segments = mode === 'line' ? splitLineMode(normalized) : splitSentenceMode(normalized, lang)
  // A chunk of only punctuation/symbols/emoji (`* * *`, `—`, `😀😀`) has no
  // real words and can't be spoken as a segment.
  return segments.filter((segment) => countWords(segment) > 0)
}
