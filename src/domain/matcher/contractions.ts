import type { Token } from './types'

/** Contractions that no suffix rule covers (`can't` would otherwise become "ca not"). */
const IRREGULAR: ReadonlyMap<string, readonly string[]> = new Map([
  ["i'm", ['i', 'am']],
  ["let's", ['let', 'us']],
  ["can't", ['cannot']],
  ["won't", ['will', 'not']],
  ["shan't", ['shall', 'not']],
  ["ain't", ['am', 'not']],
])

const SUFFIXES: ReadonlyArray<readonly [suffix: string, word: string]> = [
  ["n't", 'not'],
  ["'re", 'are'],
  ["'ve", 'have'],
  ["'ll", 'will'],
  ["'d", 'would'],
]

/** Only after these words is `'s` a contracted "is"; elsewhere it is a possessive (`god's`). */
const IS_HOSTS: ReadonlySet<string> = new Set([
  'it',
  'that',
  'what',
  'there',
  'here',
  'he',
  'she',
  'who',
  'where',
  'how',
])

/** Typographic single quotes become `'` too, so `‘I’m’` must still read as `i'm`. */
const EDGE_APOSTROPHES = /^'+|'+$/gu

/** KJV spellings split what speech recognition writes as one word. */
const SPLIT_COMPOUNDS: ReadonlyMap<string, string> = new Map([
  ['can not', 'cannot'],
  ['for ever', 'forever'],
])

function expand(word: string): readonly string[] | undefined {
  const irregular = IRREGULAR.get(word)
  if (irregular) return irregular
  if (word.endsWith("'s")) {
    const host = word.slice(0, -2)
    return IS_HOSTS.has(host) ? [host, 'is'] : undefined
  }
  for (const [suffix, expansion] of SUFFIXES) {
    if (word.length > suffix.length && word.endsWith(suffix)) {
      return [word.slice(0, -suffix.length), expansion]
    }
  }
  return undefined
}

/**
 * EN: `I'm` and `I am` must compare equal, so contractions become full words
 * that keep the raw range of the contraction.
 */
export function expandContractions(tokens: readonly Token[]): Token[] {
  return tokens.flatMap((token) => {
    const words = expand(token.text.replace(EDGE_APOSTROPHES, ''))
    return words ? words.map((text) => ({ ...token, text })) : [token]
  })
}

/** EN: `can not` → `cannot`, `for ever` → `forever`, spanning both raw words. */
export function joinSplitCompounds(tokens: readonly Token[]): Token[] {
  const joined: Token[] = []
  for (const token of tokens) {
    const previous = joined.at(-1)
    const compound = previous && SPLIT_COMPOUNDS.get(`${previous.text} ${token.text}`)
    if (previous && compound) {
      joined[joined.length - 1] = { text: compound, rawStart: previous.rawStart, rawEnd: token.rawEnd }
    } else {
      joined.push(token)
    }
  }
  return joined
}
