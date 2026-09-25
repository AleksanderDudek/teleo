/** Memory-mode levels (spec §7.3), easiest first. */
export const MEMORY_LEVELS = ['initials', 'alternate', 'hidden'] as const
export type MemoryLevel = (typeof MEMORY_LEVELS)[number]

export interface MaskedWord {
  /** What to display: the word, or the word with letters replaced by dots. */
  text: string
  masked: boolean
}

const LETTER = /[\p{L}\p{N}]/u
const DOT = '·'

/** Replaces letters/digits (after the first `keep`) with dots; punctuation stays. */
function hideLetters(word: string, keep: number): string {
  let seen = 0
  return [...word]
    .map((char) => {
      if (!LETTER.test(char)) return char
      seen++
      return seen <= keep ? char : DOT
    })
    .join('')
}

/**
 * Masks a sentence for memory practice: first letters only, every second word
 * hidden, or everything hidden (punctuation always shows the sentence's shape).
 * `revealed` (per whitespace word) shows words the speaker has already said.
 */
export function maskWords(content: string, level: MemoryLevel, revealed: readonly boolean[] = []): MaskedWord[] {
  return content
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((word, index) => {
      const hide = level === 'initials' ? true : level === 'alternate' ? index % 2 === 1 : true
      if (!hide || revealed[index]) return { text: word, masked: false }
      return { text: hideLetters(word, level === 'initials' ? 1 : 0), masked: true }
    })
}
