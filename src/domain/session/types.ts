/** Maximum number of segments in one expanded session (spec §8.1). */
export const MAX_SESSION_SEGMENTS = 150

/** Maximum number of times a single template item may repeat. */
export const MAX_REPEAT = 150

/** One line of a session template: a whole text (or chosen segments) repeated `repeat` times. */
export interface TemplateItem {
  textId: string
  /** Subset of the text's segments, in the order they should be spoken. Omitted = whole text. */
  segmentIds?: string[]
  repeat: number
}

/**
 * One segment to speak in an expanded session. A `block` is one repetition of
 * one template item; `fullText` marks blocks that cover every active segment
 * of the text in order — only those count as a text repetition (spec §8.4).
 */
export interface PlanEntry {
  segmentId: string
  textId: string
  block: number
  fullText: boolean
  /** Index of the producing item in the original template's `items` array. */
  item: number
}

export type EntryStatus = 'pending' | 'accepted' | 'skipped'

/** Progress of one plan entry inside a session run. */
export interface EntryState {
  status: EntryStatus
  attempts: number
  /** Accepted on the first attempt. */
  firstTry: boolean
  /** XP awarded for this entry (segment XP incl. bonus and multiplier). */
  xp: number
  /** Memory mode: the full text was revealed while saying it (no memory credit). */
  hinted?: boolean
}

/** Active (non-archived) segments of each text, in reading order. */
export type SegmentsByText = ReadonlyMap<string, ReadonlyArray<{ id: string }>>
