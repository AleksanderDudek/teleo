import { useEffect, useState } from 'react'
import { resolveEngine } from '@/domain/speech/registry'
import type { SpeechEngine } from '@/domain/speech/SpeechEngine'
import type { SpeechLang } from '@/domain/types'
import { useAppSettings } from '@/stores/settings'

export type EngineState =
  | { status: 'loading' }
  | { status: 'unsupported' }
  | { status: 'ready'; engine: SpeechEngine; onDevice: boolean }

/** The speech engine chosen in Settings (auto-detected by default) for a language. */
export function useSpeechEngine(lang: SpeechLang): EngineState {
  const preference = useAppSettings().engine
  const [state, setState] = useState<EngineState>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void (async () => {
      const engine = await resolveEngine(preference)
      if (!alive) return
      if (!engine) return setState({ status: 'unsupported' })
      const onDevice = (await engine.onDeviceStatus?.(lang)) === 'available'
      if (alive) setState({ status: 'ready', engine, onDevice })
    })()
    return () => {
      alive = false
    }
  }, [preference, lang])
  return state
}
