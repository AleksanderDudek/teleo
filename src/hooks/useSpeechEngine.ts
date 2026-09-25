import { useEffect, useState } from 'react'
import { resolveEngine, speechUnavailableReason } from '@/domain/speech/registry'
import type { SpeechEngine } from '@/domain/speech/SpeechEngine'
import type { SpeechLang } from '@/domain/types'
import { useAppSettings } from '@/stores/settings'
import { useWhisperStore } from '@/stores/whisper'

export type EngineState =
  | { status: 'loading' }
  /** `model-missing`: Whisper was chosen but its model is not downloaded yet. */
  | { status: 'unsupported'; reason: 'not-supported' | 'model-missing' }
  | { status: 'ready'; engine: SpeechEngine; onDevice: boolean }

/** The speech engine chosen in Settings (auto-detected by default) for a language. */
export function useSpeechEngine(lang: SpeechLang): EngineState {
  const { engine: preference, whisperModel } = useAppSettings()
  // A model download or deletion can change which engine is usable.
  const whisperRevision = useWhisperStore((s) => s.revision)
  const [state, setState] = useState<EngineState>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void (async () => {
      const engine = await resolveEngine(preference, whisperModel)
      if (!alive) return
      if (!engine) return setState({ status: 'unsupported', reason: speechUnavailableReason(preference, whisperModel) })
      const onDevice = (await engine.onDeviceStatus?.(lang)) === 'available'
      if (alive) setState({ status: 'ready', engine, onDevice })
    })()
    return () => {
      alive = false
    }
  }, [preference, whisperModel, lang, whisperRevision])
  return state
}
