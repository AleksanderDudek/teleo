import { align } from './align'
import { removeFillers } from './fillers'
import { normalize } from './normalize'
import type { EvaluateOptions, MatchOp, MatchResult, OpEntry, RejectReason } from './types'

/**
 * The coverage ladder (owner request 2026-09-27; replaces spec §6.1's 95 % and the §6.4 modes): the
 * words a sentence needs on its first try, its second, and its third and every later one.
 */
export const COVERAGE_LADDER = [0.9, 0.8, 0.7] as const

/** The coverage the next try of a sentence needs after `failedTries` rejected ones. */
export function coverageNeeded(failedTries: number): number {
  const rung = Math.min(Math.max(0, Math.floor(failedTries)), COVERAGE_LADDER.length - 1)
  return COVERAGE_LADDER[rung] ?? COVERAGE_LADDER[0]
}

/** The verdict on one alignment, before it is tagged with its alternative and text. */
export type Verdict = Omit<MatchResult, 'bestAlternativeIndex' | 'transcript'>

interface Candidate {
  result: MatchResult
  cost: number
}

function unmatched(reason: 'empty' | 'emptySource', sourceWords: number, threshold: number): MatchResult {
  return {
    accepted: false,
    coverage: 0,
    matched: 0,
    near: 0,
    missing: 0,
    extra: 0,
    wrong: 0,
    ops: [],
    bestAlternativeIndex: -1,
    sourceWords,
    threshold,
    reason,
    transcript: '',
  }
}

/**
 * The first failed condition, in the order the user should fix them; null = accepted. A misheard
 * (wrong) word only lowers coverage: recognisers write words said differently.
 */
function rejectReason(extra: number, covered: boolean): RejectReason | null {
  if (extra > 0) return 'extra'
  return covered ? null : 'coverage'
}

/**
 * Fewest matched + near words that reach the coverage threshold. `threshold` is
 * read as whole percent, so 19 of 20 words is exactly 95%.
 */
export function requiredCoverage(sourceWords: number, threshold: number): number {
  return Math.ceil((Math.round(threshold * 100) * sourceWords) / 100)
}

/** Counts and acceptance (spec §6.1, §6.4) of one alignment of the whole source. */
export function verdictOf(ops: OpEntry[], sourceWords: number, threshold: number): Verdict {
  const count = (op: MatchOp) => ops.filter((entry) => entry.op === op).length
  const matched = count('match')
  const near = count('near')
  const extra = count('extra')
  const wrong = count('wrong')
  const covered = matched + near >= requiredCoverage(sourceWords, threshold)
  const reason = rejectReason(extra, covered)
  return {
    accepted: reason === null,
    coverage: (matched + near) / sourceWords,
    matched,
    near,
    missing: count('missing'),
    extra,
    wrong,
    ops,
    sourceWords,
    threshold,
    reason,
  }
}

/**
 * Accepted first, then higher coverage (compared as word counts: every
 * alternative shares the source length), fewer extra + wrong words, lower cost.
 */
function isBetter(a: Candidate, b: Candidate): boolean {
  if (a.result.accepted !== b.result.accepted) return a.result.accepted
  const coveredA = a.result.matched + a.result.near
  const coveredB = b.result.matched + b.result.near
  if (coveredA !== coveredB) return coveredA > coveredB
  const errorsA = a.result.extra + a.result.wrong
  const errorsB = b.result.extra + b.result.wrong
  if (errorsA !== errorsB) return errorsA < errorsB
  return a.cost < b.cost
}

/**
 * Decides whether one utterance says the source sentence (spec §6.1): at least
 * `threshold` of the source words spoken (by default the first rung of the
 * coverage ladder) and no word outside the source. Every
 * recognition alternative is scored and the best one is reported; on a full tie
 * the earlier (more confident) alternative wins.
 */
export function evaluate(
  source: string,
  alternatives: readonly string[],
  options: EvaluateOptions,
): MatchResult {
  const { lang, threshold = COVERAGE_LADDER[0] } = options
  const sourceWords = normalize(source, lang).map((token) => token.text)
  if (sourceWords.length === 0) return unmatched('emptySource', 0, threshold)

  const keep = new Set(sourceWords)
  let best: Candidate | undefined
  for (const [index, transcript] of alternatives.entries()) {
    const spoken = removeFillers(normalize(transcript, lang), lang, keep).map((token) => token.text)
    if (spoken.length === 0) continue
    const { ops, cost } = align(sourceWords, spoken, lang)
    const verdict = verdictOf(ops, sourceWords.length, threshold)
    const candidate = { result: { ...verdict, bestAlternativeIndex: index, transcript }, cost }
    if (!best || isBetter(candidate, best)) best = candidate
  }
  return best?.result ?? unmatched('empty', sourceWords.length, threshold)
}
