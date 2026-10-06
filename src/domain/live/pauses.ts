/**
 * How long the player waits for the rest of a sentence (owner request 2026-10-06): a breath at a comma, or a moment to
 * read ahead in a long verse, must not end the try.
 */

/** Live mode: after the recogniser's short silence (1.5 s), how much longer a sentence left mid-way waits. */
export const MID_SENTENCE_HOLD_MS = 2500

/** Tap mode: the quiet time that ends an utterance — 1.5 s up to 10 words, 60 ms more per word, at most 3 s. */
export function utteranceSilenceMs(words: number): number {
  return Math.min(3000, 1500 + Math.max(0, words - 10) * 60)
}
