import type { EngineId } from '@/domain/types'
import type { SpeechEngine } from './SpeechEngine'
import { WebSpeechEngine } from './WebSpeechEngine'

export type EnginePreference = 'auto' | EngineId

let webSpeech: WebSpeechEngine | undefined

/** One shared Web Speech engine: it owns the (single) microphone session. */
export function webSpeechEngine(): WebSpeechEngine {
  webSpeech ??= new WebSpeechEngine()
  return webSpeech
}

/**
 * Engine for a preference (spec §5.1: automatic feature detection, user override
 * in Settings). Returns null when nothing usable exists in this browser.
 */
export async function resolveEngine(preference: EnginePreference): Promise<SpeechEngine | null> {
  const web = webSpeechEngine()
  if (preference !== 'whisper' && (await web.isSupported())) return web
  return null
}
