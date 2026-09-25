import type { Strictness } from '@/domain/types'
import { align } from './align'
import { removeFillers } from './fillers'
import { normalize } from './normalize'
import type { EvaluateOptions, MatchOp, MatchResult, RejectReason } from './types'

const DEFAULT_THRESHOLD = 0.95

/** The verdict for one alternative, before it is tagged with its index and text. */
type Score = Omit<MatchResult, 'bestAlternativeIndex' | 'transcript'>

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

function score(
  source: readonly string[],
  spoken: readonly string[],
  strictness: Strictness,
  percent: number,
): { score: Score; cost: number } {
  const { ops, cost } = align(source, spoken)
  const count = (op: MatchOp) => ops.filter((entry) => entry.op === op).length
  const matched = count('match')
  const near = count('near')
  const extra = count('extra')
  const wrong = count('wrong')
  // Integer comparison: 19 of 20 words is exactly 95%.
  const covered = (matched + near) * 100 >= percent * source.length
  // Strict: a wrong word is a word outside the source. Lenient: it only lowers coverage.
  const reason: RejectReason | null =
    extra > 0 ? 'extra' : strictness === 'strict' && wrong > 0 ? 'wrong' : covered ? null : 'coverage'
  return {
    score: {
      accepted: reason === null,
      coverage: (matched + near) / source.length,
      matched,
      near,
      missing: count('missing'),
      extra,
      wrong,
      ops,
      sourceWords: source.length,
      reason,
    },
    cost,
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
  const { lang, strictness, threshold = DEFAULT_THRESHOLD } = options
  const sourceWords = normalize(source, lang).map((token) => token.text)
  if (sourceWords.length === 0) return unmatched('emptySource', 0)

  const keep = new Set(sourceWords)
  const percent = Math.round(threshold * 100)
  let best: Candidate | undefined
  for (const [index, transcript] of alternatives.entries()) {
    const spoken = removeFillers(normalize(transcript, lang), lang, keep).map((token) => token.text)
    if (spoken.length === 0) continue
    const scored = score(sourceWords, spoken, strictness, percent)
    const candidate = {
      result: { ...scored.score, bestAlternativeIndex: index, transcript },
      cost: scored.cost,
    }
    if (!best || isBetter(candidate, best)) best = candidate
  }
  return best?.result ?? unmatched('empty', sourceWords.length)
}
