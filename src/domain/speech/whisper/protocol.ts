import type { SpeechLang } from '@/domain/types'
import { isWhisperModelId, type WhisperModelId } from './models'

/**
 * Messages between the app and `whisper.worker.ts`. Every request carries an
 * `id`; the worker answers with the same id (progress events first, then
 * exactly one final response: `prepared`, `transcript`, `released` or `error`).
 */
export type WhisperDevice = 'webgpu' | 'wasm'

export type WorkerRequest =
  /** Load a model; `download: true` (explicit user action only) may fetch it from Hugging Face first. */
  | { type: 'prepare'; id: number; model: WhisperModelId; download: boolean }
  /** 16 kHz mono samples; the buffer is transferred. */
  | { type: 'transcribe'; id: number; model: WhisperModelId; lang: SpeechLang; audio: Float32Array }
  /** Dispose every loaded model (e.g. after the model was deleted). */
  | { type: 'release'; id: number }

export type WorkerErrorCode = 'model-missing' | 'network' | 'storage-full' | 'unknown'

export type WorkerResponse =
  | { type: 'progress'; id: number; loaded: number; total: number }
  | { type: 'prepared'; id: number; device: WhisperDevice }
  | { type: 'transcript'; id: number; text: string }
  | { type: 'released'; id: number }
  | { type: 'error'; id: number; code: WorkerErrorCode; message: string }

const ERROR_CODES: readonly WorkerErrorCode[] = ['model-missing', 'network', 'storage-full', 'unknown']
const LANGS: readonly SpeechLang[] = ['pl-PL', 'en-US']
const DEVICES: readonly WhisperDevice[] = ['webgpu', 'wasm']

type Fields = Record<string, unknown>

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null
const isId = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0
const isCount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value)

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isRecord(value) || !isId(value.id)) return false
  switch (value.type) {
    case 'prepare':
      return isWhisperModelId(value.model) && typeof value.download === 'boolean'
    case 'transcribe':
      return isWhisperModelId(value.model) && oneOf(LANGS, value.lang) && value.audio instanceof Float32Array
    case 'release':
      return true
    default:
      return false
  }
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value) || !isId(value.id)) return false
  switch (value.type) {
    case 'progress':
      return isCount(value.loaded) && isCount(value.total)
    case 'prepared':
      return oneOf(DEVICES, value.device)
    case 'transcript':
      return typeof value.text === 'string'
    case 'released':
      return true
    case 'error':
      return oneOf(ERROR_CODES, value.code) && typeof value.message === 'string'
    default:
      return false
  }
}

/** Maps a failure inside the worker (transformers.js, fetch, Cache Storage) to a code the UI understands. */
export function classifyError(error: unknown): WorkerErrorCode {
  if (!(error instanceof Error)) return 'unknown'
  if (error.name === 'ModelFileNotFoundError') return 'model-missing'
  if (error.name === 'QuotaExceededError') return 'storage-full'
  // Chrome: "Failed to fetch", Firefox: "NetworkError when attempting to fetch resource.", Safari: "Load failed".
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return 'network'
  return 'unknown'
}
