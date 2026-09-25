import type { SpeechErrorCode } from '@/domain/speech/SpeechEngine'
import { isIosStandalone } from './vendor'

/** Errors the user fixes in the speech settings (engine choice, offline Whisper download). */
export function pointsToSpeechSettings(code: SpeechErrorCode): boolean {
  return code === 'not-supported' || code === 'model-missing' || isIosStandalone()
}
