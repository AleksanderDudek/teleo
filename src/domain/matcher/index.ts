/** Speech comparison engine (spec §6). Pure module: no DOM, no storage. */

export type {
  DiffPart,
  DiffStatus,
  EvaluateOptions,
  MatchOp,
  MatchResult,
  OpEntry,
  RejectReason,
  Token,
} from './types'
export { align } from './align'
export { buildDiff } from './diff'
export { evaluate } from './evaluate'
export { removeFillers } from './fillers'
export { normalize } from './normalize'
export { compareWords, levenshtein, stripDiacritics } from './similarity'
