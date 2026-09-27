/** Speech comparison engine (spec §6). Pure module: no DOM, no storage. */

export type {
  DiffPart,
  DiffStatus,
  EvaluateOptions,
  LiveProgress,
  MatchOp,
  MatchResult,
  OpEntry,
  PrefixMatch,
  PrefixOptions,
  RejectReason,
  Token,
} from './types'
export { align } from './align'
export { buildDiff } from './diff'
export { COVERAGE_LADDER, coverageNeeded, evaluate } from './evaluate'
export { removeFillers } from './fillers'
export { matchPrefix, progressOf } from './live'
export { normalize } from './normalize'
export { compareWords, levenshtein, stripDiacritics } from './similarity'
