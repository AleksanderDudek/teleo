import { compareWords, evaluate, matchPrefix, normalize, progressOf, removeFillers, type LiveProgress, type MatchResult } from '@/domain/matcher'
import type { Lang, Strictness } from '@/domain/types'

/** The sentence currently expected in live mode. */
export interface LiveTarget {
  entryIndex: number
  source: string
}

export type LiveEvent =
  | { type: 'progress'; entryIndex: number; progress: LiveProgress; window: string }
  | { type: 'accepted'; entryIndex: number; result: MatchResult; transcript: string }
  | { type: 'rejected'; entryIndex: number; result: MatchResult; transcript: string; cause: 'pause' | 'overflow' | 'restart' }

export interface LiveTracker {
  /** Sets the next expected sentence; words already heard after the last one are checked at once. */
  setTarget(target: LiveTarget | null): LiveEvent[]
  /**
   * Whole transcript of the current recognition (final + interim, best hypothesis) and,
   * optionally, the other hypotheses for the same audio (used when a pause settles a sentence).
   */
  update(transcript: string, alternatives?: readonly string[]): LiveEvent[]
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
 *
 * Recognisers are not append-only: they revise interim words (the end of the
 * last sentence is re-located by matching it again) and restart on their own
 * (unmatched words are carried over into the next recognition).
 */
export function createLiveTracker(options: LiveTrackerOptions): LiveTracker {
  const { lang, strictness, overflowWords = 8 } = options
  /** Unmatched words carried over from recognitions that ended. */
  let carry: string[] = []
  /** Words of the current recognition (best hypothesis) and of its alternatives. */
  let current: string[] = []
  let alternatives: string[][] = []
  /** Words of `carry + current` already assigned to earlier sentences. */
  let consumed = 0
  let target: LiveTarget | null = null
  let previousTail: string[] = []
  /** Where the last accepted sentence started (to re-locate its end after revisions). */
  let lastAccepted: { start: number; source: string; tail: string[] } | null = null

  const allWords = () => (carry.length ? [...carry, ...current] : current)
  const windowText = () => allWords().slice(consumed).join(' ')
  const spokenTokens = (text: string, source: string) =>
    removeFillers(normalize(text, lang), lang, new Set(normalize(source, lang).map((t) => t.text)))

  /** Consumes the whole window (after a verdict) so the next attempt starts clean. */
  const discardWindow = () => {
    consumed = allWords().length
    lastAccepted = null
  }

  const accept = (sentence: LiveTarget, result: MatchResult, transcript: string): LiveEvent[] => {
    previousTail = normalize(sentence.source, lang)
      .slice(-TAIL_TOKENS)
      .map((t) => t.text)
    target = null // the caller decides what comes next (and when)
    return [{ type: 'accepted', entryIndex: sentence.entryIndex, result, transcript }]
  }

  /**
   * The speaker slipped and started the sentence again without pausing: find the
   * last clean fresh start (the sentence's first word followed by no errors) in a
   * window that already contains an error. Returns its raw-word offset, or null.
   */
  const findRestart = (sentence: LiveTarget, window: string): number | null => {
    const first = normalize(sentence.source, lang)[0]?.text
    if (!first || progressOf(sentence.source, window, lang).errors === 0) return null
    const raw = splitWords(window)
    const starts = spokenTokens(window, sentence.source)
      .filter((token, i) => i > 0 && token.rawStart > 0 && compareWords(first, token.text) !== 'none')
      .map((token) => token.rawStart)
    for (const start of starts.reverse()) {
      if (progressOf(sentence.source, raw.slice(start).join(' '), lang).errors === 0) return start
    }
    return null
  }

  const check = (): LiveEvent[] => {
    const sentence = target
    if (!sentence) return []
    const window = windowText()
    const tailBefore = previousTail
    const match = window ? matchPrefix(sentence.source, window, { lang, strictness, previousTail: tailBefore }) : null
    if (match) {
      lastAccepted = { start: consumed, source: sentence.source, tail: tailBefore }
      consumed += match.consumedRawWords
      return accept(sentence, match.result, match.result.transcript)
    }

    const restart = window ? findRestart(sentence, window) : null
    if (restart !== null) {
      const slip = splitWords(window).slice(0, restart).join(' ')
      // Words carried over a recogniser restart are an interruption, not the speaker's slip.
      const interrupted = consumed + restart <= carry.length
      consumed += restart
      lastAccepted = null
      if (interrupted) return check()
      const result = evaluate(sentence.source, [slip], { lang, strictness })
      return [{ type: 'rejected', entryIndex: sentence.entryIndex, result, transcript: slip, cause: 'restart' }, ...check()]
    }

    const sourceTokens = normalize(sentence.source, lang).length
    const heard = spokenTokens(window, sentence.source)
    if (heard.length > sourceTokens + overflowWords) {
      const result = evaluate(sentence.source, [window], { lang, strictness })
      discardWindow()
      return [{ type: 'rejected', entryIndex: sentence.entryIndex, result, transcript: window, cause: 'overflow' }]
    }
    return [{ type: 'progress', entryIndex: sentence.entryIndex, progress: progressOf(sentence.source, window, lang), window }]
  }

  return {
    setTarget(next) {
      target = next
      return check()
    },

    update(transcript, others = []) {
      current = splitWords(transcript)
      alternatives = others.map(splitWords)
      const words = allWords()
      // Interim words get revised ("I am" → "I'm"): find where the last sentence ends now.
      if (lastAccepted && lastAccepted.start >= carry.length) {
        const again = matchPrefix(lastAccepted.source, words.slice(lastAccepted.start).join(' '), {
          lang,
          strictness,
          previousTail: lastAccepted.tail,
        })
        if (again) consumed = lastAccepted.start + again.consumedRawWords
      }
      // Hypotheses can also shrink; never point past the end of what is heard now.
      consumed = Math.min(consumed, words.length)
      return check()
    },

    pause() {
      const sentence = target
      if (!sentence) return []
      const window = windowText()
      if (spokenTokens(window, sentence.source).length === 0) return []
      // Other hypotheses for the same audio, and the words after a recogniser restart alone
      // (the speaker may have started over when recognition was interrupted).
      const windows = [
        window,
        ...alternatives.map((words) => [...carry, ...words].slice(consumed).join(' ')),
        ...(consumed < carry.length ? [current.join(' ')] : []),
      ].filter(Boolean)
      // A plain evaluation also accepts a long sentence whose final word was dropped,
      // which the prefix rule deliberately waits on while the speaker might continue.
      const result = evaluate(sentence.source, windows, { lang, strictness })
      discardWindow()
      if (result.accepted) return accept(sentence, result, result.transcript)
      return [{ type: 'rejected', entryIndex: sentence.entryIndex, result, transcript: window, cause: 'pause' }]
    },

    reset() {
      carry = allWords().slice(consumed)
      current = []
      alternatives = []
      consumed = 0
      lastAccepted = null
    },

    discard() {
      discardWindow()
    },
  }
}
