/**
 * Minimal typing of the Web Speech API (not part of TypeScript's DOM lib).
 * Only the members Teleo uses.
 */
export interface RecognitionAlternativeLike {
  readonly transcript: string
  readonly confidence: number
}

export interface RecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: RecognitionAlternativeLike
}

export interface RecognitionResultListLike {
  readonly length: number
  readonly [index: number]: RecognitionResultLike
}

export interface RecognitionResultEventLike {
  readonly resultIndex: number
  readonly results: RecognitionResultListLike
}

export interface RecognitionErrorEventLike {
  readonly error: string
  readonly message?: string
}

export interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  processLocally?: boolean
  onstart: (() => void) | null
  onresult: ((event: RecognitionResultEventLike) => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

import type { OnDeviceStatus } from './SpeechEngine'

export type AvailabilityStatus = OnDeviceStatus

export interface RecognitionCtorLike {
  new (): RecognitionLike
  /** On-device recognition support (Chrome ≥ 139; feature-detected). */
  available?: (options: { langs: string[]; processLocally?: boolean }) => Promise<AvailabilityStatus>
  install?: (options: { langs: string[]; processLocally?: boolean }) => Promise<boolean>
}

export function getRecognitionCtor(scope: object = globalThis): RecognitionCtorLike | undefined {
  const holder = scope as { SpeechRecognition?: RecognitionCtorLike; webkitSpeechRecognition?: RecognitionCtorLike }
  return holder.SpeechRecognition ?? holder.webkitSpeechRecognition
}

/** WebKit (Safari, every iOS browser) reports cumulative results in continuous mode. */
export function isWebKitEngine(userAgent: string): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  return /AppleWebKit/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser|Android/.test(userAgent)
}
