import type { EngineId } from '@/domain/types'
import type { SpeechEngine } from './SpeechEngine'
import { WebSpeechEngine } from './WebSpeechEngine'
import type { WhisperEngine } from './WhisperEngine'
import type { WhisperModelId } from './whisper/models'
import { createWhisperEngine } from './whisperSetup'

export type EnginePreference = 'auto' | EngineId

let webSpeech: WebSpeechEngine | undefined
let whisper: WhisperEngine | undefined

/** One shared Web Speech engine: it owns the (single) microphone session. */
export function webSpeechEngine(): WebSpeechEngine {
  webSpeech ??= new WebSpeechEngine()
  return webSpeech
}

/** One shared Whisper engine: it owns its microphone and the single worker. */
export function whisperEngine(): WhisperEngine {
  whisper ??= createWhisperEngine()
  return whisper
}

export interface EngineCandidates {
  web: SpeechEngine
  /** `isSupported()` includes "model downloaded"; `canRun()` does not. */
  whisper: SpeechEngine & { canRun(): boolean }
}

/**
 * Engine for a preference (spec §5.1: automatic feature detection, user override
 * in Settings). `auto` prefers Web Speech (streaming, live mode) and falls back
 * to Whisper when its model is downloaded (e.g. Firefox). Null when nothing is usable.
 */
export async function pickEngine(preference: EnginePreference, engines: EngineCandidates): Promise<SpeechEngine | null> {
  const usable = async (engine: SpeechEngine) => ((await engine.isSupported()) ? engine : null)
  if (preference === 'webspeech') return usable(engines.web)
  if (preference === 'whisper') return usable(engines.whisper)
  return (await usable(engines.web)) ?? usable(engines.whisper)
}

/** Why {@link pickEngine} found nothing: the Whisper model still needs a download, or no engine works here. */
export function unavailableReason(preference: EnginePreference, engines: EngineCandidates): 'model-missing' | 'not-supported' {
  return preference === 'whisper' && engines.whisper.canRun() ? 'model-missing' : 'not-supported'
}

function candidates(whisperModel: WhisperModelId): EngineCandidates {
  const engine = whisperEngine()
  engine.useModel(whisperModel)
  return { web: webSpeechEngine(), whisper: engine }
}

export async function resolveEngine(preference: EnginePreference, whisperModel: WhisperModelId = 'base'): Promise<SpeechEngine | null> {
  return pickEngine(preference, candidates(whisperModel))
}

export function speechUnavailableReason(preference: EnginePreference, whisperModel: WhisperModelId = 'base'): 'model-missing' | 'not-supported' {
  return unavailableReason(preference, candidates(whisperModel))
}
