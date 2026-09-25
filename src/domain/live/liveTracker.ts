import { evaluate, matchPrefix, normalize, progressOf, removeFillers, type LiveProgress, type MatchResult } from '@/domain/matcher'
import type { Lang, Strictness } from '@/domain/types'

/** The sentence currently expected in live mode. */
export interface LiveTarget {
  entryIndex: number
  source: string
}

export type LiveEvent =
  | { type: 'progress'; entryIndex: number; progress: LiveProgress; window: string }
  | { type: 'accepted'; entryIndex: number; result: MatchResult; transcript: string }
  | { type: 'rejected'; entryIndex: number; result: MatchResult; transcript: string; cause: 'pause' | 'overflow' }

export interface LiveTracker {
  /** Sets the next expected sentence; words already heard after the last one are checked at once. */
  setTarget(target: LiveTarget | null): LiveEvent[]
  /** Whole transcript of the current recognition (final + interim), as the engine reports it. */
  update(transcript: string): LiveEvent[]
  /** The speaker paused: settle the current window (accept, or reject what was said). */
  pause(): LiveEvent[]
  /** The recogniser restarted: its next transcript starts from an empty string. */
  reset(): void
  /** Forget everything heard so far (e.g. the sentence was skipped). */
  discard(): void
}

export interface LiveTrackerOptions {
  lang: Lang
  strictness: Strictness
  /** Reject once the window holds this many more tokens than the sentence without a match. */
  overflowWords?: number
}

/** How many trailing tokens of an accepted sentence may reappear at the start of the next window. */
const TAIL_TOKENS = 3

const splitWords = (text: string) => text.split(/\s+/u).filter(Boolean)

/**
 * Live mode (continuous real-time checking): one growing transcript, many
 * sentences. The tracker remembers how many words earlier sentences consumed,
 * matches the rest (the "window") against the current sentence with a prefix
 * alignment, and hands whatever follows a match to the next sentence. Pure and
 * synchronous — the player feeds it engine events and renders what it returns.
 */
export function createLiveTracker(options: LiveTrackerOptions): LiveTracker {
  const { lang, strictness, overflowWords = 8 } = options
  let words: string[] = []
  let consumed = 0
  let target: LiveTarget | null = null
  let previousTail: string[] = []

  const windowText = () => words.slice(consumed).join(' ')
  const spokenTokens = (text: string, source: string) =>
    removeFillers(normalize(text, lang), lang, new Set(normalize(source, lang).map((t) => t.text)))

  /** Consumes the whole window (after a verdict) so the next attempt starts clean. */
  const discardWindow = () => {
    consumed = words.length
  }

  const accept = (current: LiveTarget, result: MatchResult, transcript: string): LiveEvent[] => {
    previousTail = normalize(current.source, lang)
      .slice(-TAIL_TOKENS)
      .map((t) => t.text)
    target = null // the caller decides what comes next (and when)
    return [{ type: 'accepted', entryIndex: current.entryIndex, result, transcript }]
  }

  const check = (): LiveEvent[] => {
    const current = target
    if (!current) return []
    const window = windowText()
    const match = window ? matchPrefix(current.source, window, { lang, strictness, previousTail }) : null
    if (match) {
      consumed += match.consumedRawWords
      return accept(current, match.result, match.result.transcript)
    }

    const sourceTokens = normalize(current.source, lang).length
    const heard = spokenTokens(window, current.source)
    if (heard.length > sourceTokens + overflowWords) {
      const result = evaluate(current.source, [window], { lang, strictness })
      discardWindow()
      return [{ type: 'rejected', entryIndex: current.entryIndex, result, transcript: window, cause: 'overflow' }]
    }
    return [{ type: 'progress', entryIndex: current.entryIndex, progress: progressOf(current.source, window, lang), window }]
  }

  return {
    setTarget(next) {
      target = next
      return check()
    },

    update(transcript) {
      words = splitWords(transcript)
      // Interim hypotheses can shrink; never point past the end of what is heard now.
      consumed = Math.min(consumed, words.length)
      return check()
    },

    pause() {
      const current = target
      if (!current) return []
      const window = windowText()
      if (spokenTokens(window, current.source).length === 0) return []
      // A plain evaluation also accepts a long sentence whose final word was dropped,
      // which the prefix rule deliberately waits on while the speaker might continue.
      const result = evaluate(current.source, [window], { lang, strictness })
      discardWindow()
      if (result.accepted) return accept(current, result, window)
      return [{ type: 'rejected', entryIndex: current.entryIndex, result, transcript: window, cause: 'pause' }]
    },

    reset() {
      words = []
      consumed = 0
    },

    discard() {
      discardWindow()
    },
  }
}
