import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SpeechError, type SpeechEngine, type SpeechErrorCode, type SpeechResult } from '@/domain/speech/SpeechEngine'
import type { SpeechLang } from '@/domain/types'

export type CapturePhase = 'idle' | 'starting' | 'listening' | 'stopping'

/**
 * One utterance per tap (spec §8.3/2): start → live transcript → stop on
 * silence (or a second tap) → `onResult`. Errors surface as codes for i18n.
 */
export function useTapCapture(options: {
  engine: SpeechEngine | null
  lang: SpeechLang
  onResult: (result: SpeechResult) => void
}) {
  const { engine, lang } = options
  const onResult = useRef(options.onResult)
  useLayoutEffect(() => {
    onResult.current = options.onResult
  })
  const [phase, setPhase] = useState<CapturePhase>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<SpeechErrorCode | null>(null)
  const phaseRef = useRef<CapturePhase>('idle')
  const update = (next: CapturePhase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const stop = useCallback(async () => {
    if (!engine || phaseRef.current !== 'listening') return
    update('stopping')
    const result = await engine.stop()
    update('idle')
    onResult.current(result)
  }, [engine])

  const start = useCallback(async () => {
    if (!engine || phaseRef.current !== 'idle') return
    setError(null)
    setTranscript('')
    update('starting')
    try {
      await engine.start({
        lang,
        onTranscript: (text) => setTranscript(text),
        onSilence: () => void stop(),
        onError: (e) => {
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
  }, [engine, lang, stop])

  const toggle = useCallback(() => {
    if (phaseRef.current === 'idle') void start()
    else if (phaseRef.current === 'listening') void stop()
  }, [start, stop])

  const cancel = useCallback(() => {
    engine?.abort()
    update('idle')
  }, [engine])

  // Never leave the microphone open when the component goes away.
  useEffect(() => () => engine?.abort(), [engine])

  return { phase, transcript, error, start, stop, toggle, cancel, clearError: () => setError(null) }
}
