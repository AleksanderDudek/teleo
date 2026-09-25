import type { Lang } from '@/domain/types'
import { stripDiacritics } from './similarity'
import type { Token } from './types'

const KINDS = ['zero', 'unit', 'teen', 'tens', 'hundreds', 'thousand'] as const
type Kind = (typeof KINDS)[number]

interface NumberWord {
  kind: Kind
  value: number
}

/** Word forms of each kind in value order; an inner array lists forms of one value. */
type Forms = Record<Kind, ReadonlyArray<string | readonly string[]>>

const VALUE_AT: Record<Kind, (index: number) => number> = {
  zero: () => 0,
  unit: (index) => index + 1,
  teen: (index) => index + 10,
  tens: (index) => (index + 2) * 10,
  hundreds: (index) => (index + 1) * 100,
  thousand: () => 1000,
}

/** Spellings without diacritics that are real words: "piec" is an oven, not "pięć". */
const NOT_NUMBERS: ReadonlySet<string> = new Set(['piec'])

/**
 * Every form is also registered without diacritics (`dwadziescia`), because the
 * near-match tolerance for missing diacritics comes too late for number words:
 * they are turned into digits first.
 */
function lexicon(forms: Forms): ReadonlyMap<string, NumberWord> {
  const words = new Map<string, NumberWord>()
  for (const kind of KINDS) {
    forms[kind].forEach((variants, index) => {
      const entry = { kind, value: VALUE_AT[kind](index) }
      for (const word of [variants].flat()) {
        words.set(word, entry)
        const bare = stripDiacritics(word)
        if (!NOT_NUMBERS.has(bare)) words.set(bare, entry)
      }
    })
  }
  return words
}

/** Basic (nominative) forms of 0–1000 only (spec §6.2); inflected forms stay words. */
const LEXICON: Record<Lang, ReadonlyMap<string, NumberWord>> = {
  en: lexicon({
    zero: ['zero'],
    unit: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
    teen: [
      'ten',
      'eleven',
      'twelve',
      'thirteen',
      'fourteen',
      'fifteen',
      'sixteen',
      'seventeen',
      'eighteen',
      'nineteen',
    ],
    tens: ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],
    // Bare "hundred" = 100; "two hundred" is handled by the parser.
    hundreds: ['hundred'],
    thousand: ['thousand'],
  }),
  pl: lexicon({
    zero: ['zero'],
    unit: [
      ['jeden', 'jedna', 'jedno'],
      ['dwa', 'dwie'],
      'trzy',
      'cztery',
      'pięć',
      'sześć',
      'siedem',
      'osiem',
      'dziewięć',
    ],
    teen: [
      'dziesięć',
      'jedenaście',
      'dwanaście',
      'trzynaście',
      'czternaście',
      'piętnaście',
      'szesnaście',
      'siedemnaście',
      'osiemnaście',
      'dziewiętnaście',
    ],
    tens: [
      'dwadzieścia',
      'trzydzieści',
      'czterdzieści',
      'pięćdziesiąt',
      'sześćdziesiąt',
      'siedemdziesiąt',
      'osiemdziesiąt',
      'dziewięćdziesiąt',
    ],
    hundreds: [
      'sto',
      'dwieście',
      'trzysta',
      'czterysta',
      'pięćset',
      'sześćset',
      'siedemset',
      'osiemset',
      'dziewięćset',
    ],
    thousand: ['tysiąc'],
  }),
}

const DIGITS = /^\d+$/u
const LEADING_ZEROS = /^0+(?=\d)/u

function isBelowHundred(word: NumberWord | undefined): boolean {
  return word?.kind === 'unit' || word?.kind === 'teen' || word?.kind === 'tens'
}

/**
 * The longest number (0–1000) spelled out from `start`: `[hundreds] [tens] [unit | teen]`,
 * `zero` or a thousand; `end` is exclusive. A tens word never follows a tens word
 * ("twenty twenty" is two numbers) and nothing above 1000 is built ("two thousand" = 2, 1000).
 */
function parseNumber(
  words: readonly string[],
  start: number,
  lang: Lang,
): { value: number; end: number } | undefined {
  const word = (i: number) => words[i] ?? ''
  const lookup = (i: number) => LEXICON[lang].get(word(i))
  const first = lookup(start)
  if (first?.kind === 'zero' || first?.kind === 'thousand') {
    return { value: first.value, end: start + 1 }
  }

  let value = 0
  let i = start
  if (lang === 'en') {
    // "a thousand", "one thousand", "a hundred", "two hundred": the article counts as one.
    const factor = word(i) === 'a' ? 1 : first?.kind === 'unit' ? first.value : 0
    if (factor === 1 && word(i + 1) === 'thousand') return { value: 1000, end: i + 2 }
    if (factor > 0 && word(i + 1) === 'hundred') {
      value = factor * 100
      i += 2
    }
  }
  if (i === start && first?.kind === 'hundreds') {
    value = first.value
    i += 1
  }
  // "one hundred and five"; any other "and" is an ordinary word.
  if (lang === 'en' && i > start && word(i) === 'and' && isBelowHundred(lookup(i + 1))) i += 1

  const next = lookup(i)
  if (next?.kind === 'tens') {
    value += next.value
    i += 1
    const unit = lookup(i)
    if (unit?.kind === 'unit') {
      value += unit.value
      i += 1
    }
  } else if (next?.kind === 'teen' || next?.kind === 'unit') {
    value += next.value
    i += 1
  }
  return i > start ? { value, end: i } : undefined
}

/**
 * `10`, `010` and `dziesięć` must compare equal: digit tokens get their canonical
 * form, and number words become one digit token spanning all their raw words.
 */
export function normalizeNumbers(tokens: readonly Token[], lang: Lang): Token[] {
  const words = tokens.map((token) => token.text)
  const result: Token[] = []
  let resumeAt = 0
  for (const [index, token] of tokens.entries()) {
    if (index < resumeAt) continue
    const parsed = parseNumber(words, index, lang)
    if (parsed) {
      const rawEnd = tokens[parsed.end - 1]?.rawEnd ?? token.rawEnd
      result.push({ text: String(parsed.value), rawStart: token.rawStart, rawEnd })
      resumeAt = parsed.end
    } else if (DIGITS.test(token.text)) {
      result.push({ ...token, text: token.text.replace(LEADING_ZEROS, '') })
    } else {
      result.push(token)
    }
  }
  return result
}
