const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/**
 * Number of words as a reader perceives them: whitespace-separated chunks that
 * contain at least one letter or digit ("I'm" is one word, "—" is none).
 * Used for XP, segment length limits and editor hints.
 */
export function countWords(text: string): number {
  return text.split(/\s+/u).filter((chunk) => HAS_LETTER_OR_DIGIT.test(chunk)).length
}
