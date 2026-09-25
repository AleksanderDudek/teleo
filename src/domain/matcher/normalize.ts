import type { Lang } from '@/domain/types'
import { expandContractions, joinSplitCompounds } from './contractions'
import { normalizeNumbers } from './numbers'
import type { Token } from './types'

const WHITESPACE = /\s+/u
/** Capturing, so `split` keeps the separators: words at even indexes, whitespace at odd. */
const WHITESPACE_RUNS = /(\s+)/u
const APOSTROPHES = /[’‘ʼ´`]/gu
const THOUSANDS_COMMA = /(\d),(?=\d{3}(?!\d))/gu
/** No-break spaces group digits (`1 000`); a plain space may separate two spoken numbers. */
const DIGIT_GROUP_SPACE = /^[\u00a0\u202f]$/u
const ENDS_WITH_DIGIT = /\d$/u
const STARTS_WITH_DIGIT_GROUP = /^\d{3}(?!\d)/u
/** Everything but letters (with their combining marks), digits and apostrophes breaks words. */
const WORD_BREAK = /[^\p{L}\p{M}\p{N}']+/u

/** The words of the original text that token raw ranges point into. */
export function rawWords(text: string): string[] {
  const trimmed = text.trim()
  return trimmed === '' ? [] : trimmed.split(WHITESPACE)
}

function cleanWord(word: string, lang: Lang): string {
  return word
    .normalize('NFC')
    .toLocaleLowerCase(lang)
    .replace(APOSTROPHES, "'")
    .replace(THOUSANDS_COMMA, '$1')
}

/** Splits every raw word into word tokens that remember the raw word they came from. */
function tokenize(text: string, lang: Lang): Token[] {
  const parts = text.trim().split(WHITESPACE_RUNS)
  const tokens: Token[] = []
  let previousWord = ''
  for (let part = 0; part < parts.length; part += 2) {
    const raw = part / 2
    const word = cleanWord(parts[part] ?? '', lang)
    const pieces = word.split(WORD_BREAK).filter((piece) => piece !== '')
    const last = tokens.at(-1)
    if (
      last &&
      DIGIT_GROUP_SPACE.test(parts[part - 1] ?? '') &&
      ENDS_WITH_DIGIT.test(previousWord) &&
      STARTS_WITH_DIGIT_GROUP.test(word)
    ) {
      // `1 000`: the group continues the number that ended the previous raw word.
      last.text += pieces.shift() ?? ''
      last.rawEnd = raw
    }
    for (const piece of pieces) tokens.push({ text: piece, rawStart: raw, rawEnd: raw })
    previousWord = word
  }
  return tokens
}

function stripApostrophes(tokens: readonly Token[]): Token[] {
  return tokens.flatMap((token) => {
    const text = token.text.replaceAll("'", '')
    return text === '' ? [] : [{ ...token, text }]
  })
}

/**
 * Canonical word tokens for comparing a source sentence with a transcript
 * (spec §6.2): case, punctuation, apostrophes, EN contractions and spellings,
 * and numbers are unified. Filler removal is left to the caller because it
 * applies to the transcript only.
 */
export function normalize(text: string, lang: Lang): Token[] {
  let tokens = tokenize(text, lang)
  if (lang === 'en') tokens = expandContractions(tokens)
  tokens = stripApostrophes(tokens)
  if (lang === 'en') tokens = joinSplitCompounds(tokens)
  return normalizeNumbers(tokens, lang)
}
