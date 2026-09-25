import { WhisperEngine } from './WhisperEngine'
import { inspectModel, type CacheStorageLike, type StorageDeps } from './whisper/cache'
import { Microphone } from './whisper/capture'
import { WhisperClient } from './whisper/client'
import type { WhisperModelId } from './whisper/models'
import { isSafariBelow26, ortRuntime, type OrtRuntime } from './whisper/runtime'

/** Production wiring of the offline engine: one worker, one microphone, the real Cache Storage. */

/** The onnxruntime files this browser uses (the worker computes the same). */
export function currentOrtRuntime(): OrtRuntime {
  return ortRuntime({
    base: import.meta.env.BASE_URL,
    version: __ORT_VERSION__,
    legacySafari: isSafariBelow26(globalThis.navigator?.userAgent ?? ''),
  })
}

/** Cache Storage, when the browser offers it (missing on insecure origins and in some private modes). */
function cacheStorage(): CacheStorageLike | undefined {
  return typeof globalThis.caches === 'undefined' ? undefined : globalThis.caches
}

export function whisperStorage(): StorageDeps | undefined {
  const caches = cacheStorage()
  return caches ? { caches, runtime: currentOrtRuntime() } : undefined
}

/** Web Workers, WebAssembly and Cache Storage exist (the microphone is checked by the engine). */
export function whisperPlatformSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly === 'object' && cacheStorage() !== undefined
}

export async function isModelDownloaded(model: WhisperModelId): Promise<boolean> {
  const storage = whisperStorage()
  return storage ? (await inspectModel(model, storage)).ready : false
}

let client: WhisperClient | undefined

/** The one Whisper worker of the app, shared by recognition and model downloads. */
export function whisperClient(): WhisperClient {
  client ??= new WhisperClient((onMessage, onFailure) => {
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module', name: 'teleo-whisper' })
    worker.onmessage = (event) => onMessage(event.data)
    worker.onmessageerror = () => onFailure('Unreadable message from the Whisper worker')
    worker.onerror = (event) => {
      event.preventDefault()
      onFailure(event.message || 'The Whisper worker failed')
    }
    return {
      post: (message, transfer = []) => worker.postMessage(message, transfer),
      terminate: () => worker.terminate(),
    }
  })
  return client
}

export function createWhisperEngine(): WhisperEngine {
  return new WhisperEngine({
    platformSupported: whisperPlatformSupported,
    isDownloaded: isModelDownloaded,
    client: whisperClient(),
    microphone: new Microphone(),
  })
}
