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
]

type HostedSuffix = readonly [suffix: string, word: string, hosts: ReadonlySet<string>]

const wordSet = (list: string): ReadonlySet<string> => new Set(list.split(' '))

/**
 * Suffixes that are contractions only after pronouns and question words. Elsewhere
 * `'s` is a possessive (`god's`) and `'d` an elided "-ed" (`hallow'd`): one word.
 */
const HOSTED_SUFFIXES: readonly HostedSuffix[] = [
  ["'s", 'is', wordSet('it that what there here he she who where how')],
  ["'d", 'would', wordSet('i you he she it we they that who what where how there')],
]

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
  for (const [suffix, expansion, hosts] of HOSTED_SUFFIXES) {
    if (word.endsWith(suffix)) {
      const host = word.slice(0, -suffix.length)
      return hosts.has(host) ? [host, expansion] : undefined
    }
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
      joined[joined.length - 1] = {
        text: compound,
        rawStart: previous.rawStart,
        rawEnd: token.rawEnd,
      }
    } else {
      joined.push(token)
    }
  }
  return joined
}
