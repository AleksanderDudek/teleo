import type { Lang, Strictness } from '@/domain/types'

export type MatchOp = 'match' | 'near' | 'missing' | 'extra' | 'wrong'

/** One step of the word alignment between source and spoken tokens. */
export interface OpEntry {
  op: MatchOp
  /** Normalized source token (match/near/missing/wrong). */
  source?: string
  /** Normalized spoken token (match/near/extra/wrong). */
  spoken?: string
  /** Index into the normalized source tokens (match/near/missing/wrong). */
  sourceIndex?: number
}

export type RejectReason = 'empty' | 'emptySource' | 'extra' | 'wrong' | 'coverage'

export interface MatchResult {
  accepted: boolean
  /** (matched + near) / sourceWords, 0..1. */
  coverage: number
  /** Exact matches. */
  matched: number
  /** Tolerated speech-recognition errors; they count toward coverage. */
  near: number
  missing: number
  extra: number
  wrong: number
  ops: OpEntry[]
  /** -1 when no alternative was usable. */
  bestAlternativeIndex: number
  sourceWords: number
  /** null when accepted. */
  reason: RejectReason | null
  /** Raw text of the chosen alternative ('' when none). */
  transcript: string
}

export interface EvaluateOptions {
  lang: Lang
  strictness: Strictness
  /** Minimum coverage, default 0.95. */
  threshold?: number
}

/**
 * A normalized word. `rawStart..rawEnd` (inclusive) index the whitespace-separated
 * words of the original text, so the UI can colour exactly what the user typed.
 */
export interface Token {
  text: string
  rawStart: number
  rawEnd: number
}

export type DiffStatus = 'match' | 'near' | 'missing' | 'wrong' | 'none'

export type DiffPart =
  /** An original source word, punctuation included. */
  | { kind: 'source'; text: string; status: DiffStatus }
  /** A spoken word that is not in the source. */
  | { kind: 'spoken'; text: string; status: 'extra' | 'wrong' }
