import type { Lang } from '@/domain/types'
import type { Token } from './types'

/** Hesitation sounds that speech recognition sometimes writes down (spec §6.2). */
const FILLERS: Record<Lang, RegExp> = {
  pl: /^(?:y{2,}|e{2,}|hm+|m{2,})$/u,
  en: /^(?:u+m+|u+h+|e+r+|h+m+|m{2,})$/u,
}

/**
 * Drops fillers from transcript tokens: they are not content, so they must not
 * count as extra words. A filler that occurs in the source (`keep`) is a real
 * word there — "To err is human" — and stays.
 */
export function removeFillers(tokens: Token[], lang: Lang, keep: ReadonlySet<string>): Token[] {
  const filler = FILLERS[lang]
  return tokens.filter((token) => keep.has(token.text) || !filler.test(token.text))
}
