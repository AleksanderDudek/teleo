import type { Strictness } from '@/domain/types'
import { align } from './align'
import { removeFillers } from './fillers'
import { normalize } from './normalize'
import type { EvaluateOptions, MatchOp, MatchResult, OpEntry, RejectReason } from './types'

export const DEFAULT_THRESHOLD = 0.95

/**
 * Gentle mode (spec §6.4, widened 2026-09-27): 85 % of the words, for recognition that often loses a
 * word (accent, noise, archaic texts). One word may be lost from 7 words up; extra words still fail.
 */
export const LENIENT_THRESHOLD = 0.85

/** The coverage a sentence needs in each mode. */
export function thresholdFor(strictness: Strictness): number {
  return strictness === 'lenient' ? LENIENT_THRESHOLD : DEFAULT_THRESHOLD
}

/** The verdict on one alignment, before it is tagged with its alternative and text. */
export type Verdict = Omit<MatchResult, 'bestAlternativeIndex' | 'transcript'>

interface Candidate {
  result: MatchResult
  cost: number
}

function unmatched(reason: 'empty' | 'emptySource', sourceWords: number): MatchResult {
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
    reason,
    transcript: '',
  }
}

/** The first failed condition, in the order the user should fix them; null = accepted. */
function rejectReason(
  extra: number,
  wrong: number,
  covered: boolean,
  strictness: Strictness,
): RejectReason | null {
  if (extra > 0) return 'extra'
  // Strict: a wrong word is a word outside the source. Lenient: it only lowers coverage.
  if (strictness === 'strict' && wrong > 0) return 'wrong'
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
export function verdictOf(
  ops: OpEntry[],
  sourceWords: number,
  strictness: Strictness,
  threshold: number,
): Verdict {
  const count = (op: MatchOp) => ops.filter((entry) => entry.op === op).length
  const matched = count('match')
  const near = count('near')
  const extra = count('extra')
  const wrong = count('wrong')
  const covered = matched + near >= requiredCoverage(sourceWords, threshold)
  const reason = rejectReason(extra, wrong, covered, strictness)
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
 * `threshold` of the source words spoken and no word outside the source. Every
 * recognition alternative is scored and the best one is reported; on a full tie
 * the earlier (more confident) alternative wins.
 */
export function evaluate(
  source: string,
  alternatives: readonly string[],
  options: EvaluateOptions,
): MatchResult {
  const { lang, strictness, threshold = thresholdFor(strictness) } = options
  const sourceWords = normalize(source, lang).map((token) => token.text)
  if (sourceWords.length === 0) return unmatched('emptySource', 0)

  const keep = new Set(sourceWords)
  let best: Candidate | undefined
  for (const [index, transcript] of alternatives.entries()) {
    const spoken = removeFillers(normalize(transcript, lang), lang, keep).map((token) => token.text)
    if (spoken.length === 0) continue
    const { ops, cost } = align(sourceWords, spoken, lang)
    const verdict = verdictOf(ops, sourceWords.length, strictness, threshold)
    const candidate = { result: { ...verdict, bestAlternativeIndex: index, transcript }, cost }
    if (!best || isBetter(candidate, best)) best = candidate
  }
  return best?.result ?? unmatched('empty', sourceWords.length)
}
