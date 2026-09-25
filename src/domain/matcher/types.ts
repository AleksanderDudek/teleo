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

export interface PrefixOptions extends EvaluateOptions {
  /**
   * Normalized last tokens of the previously accepted sentence: a continuous
   * transcript may repeat them at the start of the next window.
   */
  previousTail?: readonly string[]
}

export interface PrefixMatch {
  result: MatchResult
  /** Whitespace-separated words at the start of the window that belong to this sentence. */
  consumedRawWords: number
}

/** How far the user has got into a sentence, for live highlighting. */
export interface LiveProgress {
  /** Per raw (whitespace-separated) source word: said, by all of its tokens. */
  covered: boolean[]
  /** Extra and wrong words in what was said so far. */
  errors: number
  /** Index of the last covered raw word, -1 when none. */
  lastCovered: number
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
