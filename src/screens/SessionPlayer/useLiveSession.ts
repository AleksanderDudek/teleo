import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createLiveTracker, type LiveEvent, type LiveTracker } from '@/domain/live/liveTracker'
import type { LiveProgress, MatchResult } from '@/domain/matcher'
import { SpeechError, type SpeechEngine, type SpeechErrorCode } from '@/domain/speech/SpeechEngine'
import { SPEECH_LANG, type Lang } from '@/domain/types'

export interface LiveSentence {
  entryIndex: number
  source: string
  lang: Lang
  /** Coverage the sentence needs now (its rung of the coverage ladder). */
  threshold: number
}

interface LiveSessionOptions {
  engine: SpeechEngine | null
  /** Sentence expected now; `null` when the session is over. */
  target: LiveSentence | null
  /** Resolves once the attempt is stored; the next target arrives through `target`. */
  onVerdict: (entryIndex: number, result: MatchResult, durationMs: number) => Promise<void>
}

export type LivePhase = 'idle' | 'starting' | 'listening'

/**
 * Live mode controller: ONE continuous recognition for the whole session, a
 * LiveTracker deciding sentence by sentence, verdicts recorded strictly in order.
 * Restarts recognition only when the language of the expected sentence changes.
 */
export function useLiveSession({ engine, target, onVerdict }: LiveSessionOptions) {
  const [phase, setPhase] = useState<LivePhase>('idle')
  const [progress, setProgress] = useState<LiveProgress | null>(null)
  const [error, setError] = useState<SpeechErrorCode | null>(null)
  const tracker = useRef<LiveTracker | null>(null)
  const listeningLang = useRef<Lang | null>(null)
  const targetRef = useRef(target)
  const verdict = useRef(onVerdict)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const sentenceStartedAt = useRef(0)
  const phaseRef = useRef<LivePhase>('idle')

  useLayoutEffect(() => {
    verdict.current = onVerdict
    targetRef.current = target
  })

  const setPhaseBoth = (next: LivePhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const handleRef = useRef<(events: LiveEvent[]) => void>(() => {})
  const handle = useCallback((events: LiveEvent[]) => {
    for (const event of events) {
      if (event.type === 'progress') {
        setProgress(event.progress)
        continue
      }
      setProgress(null)
      const duration = Date.now() - sentenceStartedAt.current
      sentenceStartedAt.current = Date.now()
      const { entryIndex, result } = event
      // Verdicts must reach storage in the order they were spoken.
      queue.current = queue.current
        .then(() => verdict.current(entryIndex, result, duration))
        .catch((cause: unknown) => {
          console.error('[teleo] recording a live verdict failed', cause)
          // Nothing was stored: keep listening for the same sentence instead of going silent.
          const live = tracker.current
          if (live) handleRef.current(live.setTarget(targetRef.current))
        })
    }
  }, [])
  useLayoutEffect(() => {
    handleRef.current = handle
  })

  const stop = useCallback(() => {
    engine?.abort()
    tracker.current = null
    listeningLang.current = null
    setProgress(null)
    setPhaseBoth('idle')
  }, [engine])

  const start = useCallback(async () => {
    const current = targetRef.current
    if (!engine || !current || phaseRef.current !== 'idle') return
    setError(null)
    setPhaseBoth('starting')
    const liveTracker = createLiveTracker({ lang: current.lang })
    tracker.current = liveTracker
    listeningLang.current = current.lang
    try {
      await engine.start({
        lang: SPEECH_LANG[current.lang],
        continuous: true,
        onTranscript: (text, _isFinal, alternatives) => tracker.current === liveTracker && handle(liveTracker.update(text, alternatives)),
        onSilence: () => tracker.current === liveTracker && handle(liveTracker.pause()),
        onRestart: () => liveTracker.reset(),
        onError: (e) => {
          setError(e.code)
          stop()
        },
      })
      setPhaseBoth('listening')
      sentenceStartedAt.current = Date.now()
      handle(liveTracker.setTarget(targetRef.current))
    } catch (e) {
      tracker.current = null
      const code = e instanceof SpeechError ? e.code : 'unknown'
      if (code !== 'aborted') setError(code)
      setPhaseBoth('idle')
    }
  }, [engine, handle, stop])

  // A new expected sentence — or the same one on a lower rung after a rejection: check the words
  // already heard (spill-over, a fresh start after a slip) right away.
  const targetKey = target ? `${target.entryIndex}\u0000${target.source}\u0000${target.threshold}` : ''
  useEffect(() => {
    const live = tracker.current
    if (!live) return
    const next = targetRef.current
    if (next && listeningLang.current && next.lang !== listeningLang.current) {
      // Speech recognition listens in one language: restart for a sentence in the other one.
      stop()
      void start()
      return
    }
    sentenceStartedAt.current = Date.now()
    handle(live.setTarget(next))
  }, [targetKey, handle, start, stop])

  const discard = useCallback(() => tracker.current?.discard(), [])

  // Release the microphone when the player goes away.
  useEffect(() => () => engine?.abort(), [engine])

  return { phase, progress, error, start, stop, discard }
}
