import type { Lang } from '@/domain/types'
import { alignmentTable } from './align'
import { COVERAGE_LADDER, requiredCoverage, verdictOf, type Verdict } from './evaluate'
import { removeFillers } from './fillers'
import { normalize, rawWords } from './normalize'
import type { LiveProgress, OpEntry, PrefixMatch, PrefixOptions, Token } from './types'

/** At most this many leading window words may be skipped as the previous sentence's tail. */
const MAX_SKIPPED = 3

const isSaid = (entry: OpEntry) => entry.op === 'match' || entry.op === 'near'

/** Window tokens as `evaluate` sees a transcript: fillers go unless the source has them. */
function spokenTokens(window: string, lang: Lang, sourceWords: readonly string[]): Token[] {
  return removeFillers(normalize(window, lang), lang, new Set(sourceWords))
}

function leadingTailWords(spoken: readonly Token[], previousTail: readonly string[]): number {
  const tail = new Set(previousTail)
  const leading = spoken.slice(0, MAX_SKIPPED)
  const firstOther = leading.findIndex((token) => !tail.has(token.text))
  return firstOther === -1 ? leading.length : firstOther
}

/**
 * Live mode: where does the current sentence end in a growing transcript? The
 * whole source is aligned with each prefix of the window (what follows belongs
 * to the next sentence, so it is not extra). Of the prefixes that pass the
 * acceptance rule, the cheapest wins, ties going to the shorter one. Below 100%
 * coverage the last source word must also be said, so the sentence is never
 * accepted before the user has finished it. Null while no prefix qualifies.
 */
export function matchPrefix(
  source: string,
  window: string,
  options: PrefixOptions,
): PrefixMatch | null {
  const { lang, threshold = COVERAGE_LADDER[0], previousTail = [] } = options
  const sourceWords = normalize(source, lang).map((token) => token.text)
  if (sourceWords.length === 0) return null

  const spoken = spokenTokens(window, lang, sourceWords)
  const skippable = leadingTailWords(spoken, previousTail)
  // An acceptable prefix has no extra words: each of its words is skipped or aligned with its own
  // source word — or with half of one (a word written as two) or two of them (two written as one).
  const candidates = spoken.slice(0, 2 * sourceWords.length + skippable)
  const table = alignmentTable(sourceWords, candidates.map((token) => token.text), skippable, lang)

  let best: { end: number; cost: number; verdict: Verdict } | undefined
  const shortest = Math.max(1, Math.ceil(requiredCoverage(sourceWords.length, threshold) / 2))
  for (let end = shortest; end <= candidates.length; end++) {
    const cost = table.cost(sourceWords.length, end)
    if (best && cost >= best.cost) continue
    const ops = table.ops(sourceWords.length, end)
    const verdict = verdictOf(ops, sourceWords.length, threshold)
    // The live rule; at 100% coverage the last word is said anyway.
    const last = ops.findLast((entry) => entry.sourceIndex !== undefined)
    if (verdict.accepted && last && isSaid(last)) best = { end, cost, verdict }
  }
  if (!best) return null

  const consumedRawWords = (candidates[best.end - 1]?.rawEnd ?? -1) + 1
  const transcript = rawWords(window).slice(0, consumedRawWords).join(' ')
  return { result: { ...best.verdict, bestAlternativeIndex: 0, transcript }, consumedRawWords }
}

/** A raw word is covered when it has tokens and all of them were said ("I'm" = i + am). */
function coveredRawWords(
  tokens: readonly Token[],
  rawCount: number,
  said: ReadonlySet<number>,
): boolean[] {
  const covered: (boolean | undefined)[] = Array.from({ length: rawCount }, () => undefined)
  tokens.forEach((token, index) => {
    for (let raw = token.rawStart; raw <= token.rawEnd; raw++) {
      covered[raw] = (covered[raw] ?? true) && said.has(index)
    }
  })
  return covered.map((value) => value === true)
}

/**
 * Live highlighting: the window is aligned with the best prefix of the source,
 * so the words not said yet cost nothing. On a tie the longer source prefix wins:
 * a word left out reads better than the following word counted as extra.
 */
export function progressOf(source: string, window: string, lang: Lang): LiveProgress {
  const sourceTokens = normalize(source, lang)
  const sourceWords = sourceTokens.map((token) => token.text)
  const spoken = spokenTokens(window, lang, sourceWords).map((token) => token.text)
  const table = alignmentTable(sourceWords, spoken, 0, lang)

  let end = 0
  for (let i = 1; i <= sourceWords.length; i++) {
    if (table.cost(i, spoken.length) <= table.cost(end, spoken.length)) end = i
  }
  const ops = table.ops(end, spoken.length)
  const said = new Set<number>()
  for (const entry of ops) {
    if (isSaid(entry) && entry.sourceIndex !== undefined) said.add(entry.sourceIndex)
  }
  const covered = coveredRawWords(sourceTokens, rawWords(source).length, said)
  return {
    covered,
    errors: ops.filter((entry) => entry.op === 'extra' || entry.op === 'wrong').length,
    lastCovered: covered.lastIndexOf(true),
  }
}
