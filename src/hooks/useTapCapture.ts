import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SpeechError, type SpeechEngine, type SpeechErrorCode, type SpeechResult } from '@/domain/speech/SpeechEngine'
import type { SpeechLang } from '@/domain/types'

export type CapturePhase = 'idle' | 'starting' | 'listening' | 'stopping'

/**
 * One utterance per tap (spec §8.3/2): start → live transcript → stop on
 * silence (or a second tap) → `onResult`. Errors surface as codes for i18n.
 * An offline engine recognises after `stop()` (phase `stopping`, possibly for
 * seconds); a result arriving after `cancel()` is dropped.
 */
export function useTapCapture(options: {
  engine: SpeechEngine | null
  lang: SpeechLang
  /** Quiet time that ends the utterance (longer for a long sentence); the engine's default when absent. */
  silenceMs?: number
  onResult: (result: SpeechResult) => void
}) {
  const { engine } = options
  const onResult = useRef(options.onResult)
  // Read at start: an auto-listen scheduled before the next sentence rendered must use that sentence's values.
  const settings = useRef({ lang: options.lang, silenceMs: options.silenceMs })
  useLayoutEffect(() => {
    onResult.current = options.onResult
    settings.current = { lang: options.lang, silenceMs: options.silenceMs }
  })
  const [phase, setPhase] = useState<CapturePhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<SpeechErrorCode | null>(null)
  const phaseRef = useRef<CapturePhase>('idle')
  /** Bumped by `cancel()`: a recognition still running for an older utterance must not report. */
  const utterance = useRef(0)
  const update = (next: CapturePhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const stop = useCallback(async () => {
    if (!engine || phaseRef.current !== 'listening') return
    const current = utterance.current
    update('stopping')
    let result: SpeechResult
    try {
      result = await engine.stop()
    } catch (e) {
      if (utterance.current !== current) return
      setError(e instanceof SpeechError ? e.code : 'unknown')
      update('idle')
      return
    }
    if (utterance.current !== current) return
    update('idle')
    onResult.current(result)
  }, [engine])

  const start = useCallback(async () => {
    if (!engine || phaseRef.current !== 'idle') return
    setError(null)
    setTranscript('')
    update('starting')
    try {
      const { lang, silenceMs } = settings.current
      await engine.start({
        lang,
        silenceMs,
        onTranscript: (text) => setTranscript(text),
        onSilence: () => void stop(),
        onError: (e) => {
          utterance.current++
          setError(e.code)
          engine.abort()
          update('idle')
        },
      })
      update('listening')
    } catch (e) {
      const code = e instanceof SpeechError ? e.code : 'unknown'
      if (code !== 'aborted') setError(code)
      update('idle')
    }
  }, [engine, stop])

  const toggle = useCallback(() => {
    if (phaseRef.current === 'idle') void start()
    else if (phaseRef.current === 'listening') void stop()
  }, [start, stop])

  const cancel = useCallback(() => {
    utterance.current++
    engine?.abort()
    update('idle')
  }, [engine])

  // Never leave the microphone open when the component goes away.
  useEffect(() => () => engine?.abort(), [engine])

  return { phase, transcript, error, start, stop, toggle, cancel }
}
