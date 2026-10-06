import type { EngineId, SpeechLang } from '@/domain/types'

export interface SpeechStartOptions {
  lang: SpeechLang
  /**
   * Live mode: keep listening across sentences (no auto-stop on silence) and
   * restart transparently when the browser ends recognition on its own.
   */
  continuous?: boolean
  /**
   * Whole transcript heard so far in this recognition (final + interim, best hypothesis),
   * plus the other whole-utterance hypotheses when the engine has them.
   */
  onTranscript?: (text: string, isFinal: boolean, alternatives: string[]) => void
  /** No new speech for a moment (or none at all for a while): a sentence probably ended. */
  onSilence?: () => void
  /** Tap mode: the quiet time that ends the utterance, when not the engine's default (longer for a long sentence). */
  silenceMs?: number
  /** Live mode only: recognition restarted, the next transcript starts empty. */
  onRestart?: () => void
  /** Failure after `start()` resolved (e.g. network lost mid-sentence). */
  onError?: (error: SpeechError) => void
}

export interface SpeechResult {
  /** Best transcripts first; empty when nothing was heard. */
  alternatives: string[]
  durationMs: number
  engine: EngineId
}

export interface SpeechEngine {
  readonly id: EngineId
  isSupported(): Promise<boolean>
  /** Resolves when the microphone is live; rejects with {@link SpeechError}. */
  start(options: SpeechStartOptions): Promise<void>
  /**
   * Stops listening and returns what was heard. Safe to call when idle.
   * Engines that recognise after the recording (Whisper) may take seconds and
   * reject with {@link SpeechError} when recognition fails.
   */
  stop(): Promise<SpeechResult>
  /** Stops immediately, discarding the result. */
  abort(): void
  /** On-device recognition status for a language, when the engine can tell. */
  onDeviceStatus?(lang: SpeechLang): Promise<OnDeviceStatus | undefined>
  /** Downloads on-device support for a language (call from a user gesture). */
  installOnDevice?(lang: SpeechLang): Promise<boolean>
}

export type OnDeviceStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable'

export type SpeechErrorCode =
  | 'not-supported'
  | 'permission-denied'
  | 'no-microphone'
  | 'network'
  | 'language-not-supported'
  | 'busy'
  | 'model-missing'
  /** The caller aborted while the engine was still starting (not an error to show). */
  | 'aborted'
  | 'unknown'

export class SpeechError extends Error {
  readonly code: SpeechErrorCode
  constructor(code: SpeechErrorCode, message?: string) {
    super(message ?? `Speech recognition failed: ${code}`)
    this.name = 'SpeechError'
    this.code = code
  }
}
