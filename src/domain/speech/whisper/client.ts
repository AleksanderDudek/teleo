import type { SpeechLang } from '@/domain/types'
import type { WhisperModelId } from './models'
import type { DownloadProgress } from './progress'
import { isWorkerResponse, type WhisperDevice, type WorkerErrorCode, type WorkerRequest, type WorkerResponse } from './protocol'

/** The app's side of a worker: post messages, stop it. */
export interface WorkerPort {
  post(message: WorkerRequest, transfer?: Transferable[]): void
  terminate(): void
}

/** Starts a worker that delivers its messages to `onMessage`; `onFailure` when it crashes or cannot load. */
export type WorkerFactory = (onMessage: (data: unknown) => void, onFailure: (message: string) => void) => WorkerPort

export type WhisperClientErrorCode = WorkerErrorCode | 'aborted'

export class WhisperWorkerError extends Error {
  readonly code: WhisperClientErrorCode
  constructor(code: WhisperClientErrorCode, message?: string) {
    super(message ?? `Whisper worker failed: ${code}`)
    this.name = 'WhisperWorkerError'
    this.code = code
  }
}

interface Pending {
  resolve: (response: WorkerResponse) => void
  reject: (error: WhisperWorkerError) => void
  onProgress?: (progress: DownloadProgress) => void
}

/**
 * Request/response over the Whisper worker. The worker starts lazily (it
 * loads transformers.js and onnxruntime, ~1.5 MB) and is replaced after a crash.
 */
export class WhisperClient {
  readonly #createWorker: WorkerFactory
  readonly #pending = new Map<number, Pending>()
  #worker: WorkerPort | null = null
  #nextId = 1

  constructor(createWorker: WorkerFactory) {
    this.#createWorker = createWorker
  }

  /** Loads a model (downloading it first only when `download` is set). Resolves with the device it runs on. */
  async prepare(model: WhisperModelId, options: { download: boolean; onProgress?: (progress: DownloadProgress) => void }): Promise<WhisperDevice> {
    const response = await this.#request((id) => ({ type: 'prepare', id, model, download: options.download }), [], options.onProgress)
    return response.type === 'prepared' ? response.device : 'wasm'
  }

  /** Transcribes 16 kHz mono audio; the buffer is transferred to the worker (unusable afterwards). */
  async transcribe(model: WhisperModelId, lang: SpeechLang, audio: Float32Array): Promise<string> {
    const response = await this.#request((id) => ({ type: 'transcribe', id, model, lang, audio }), [audio.buffer])
    return response.type === 'transcript' ? response.text : ''
  }

  /** Frees the models held by a running worker. */
  async release(): Promise<void> {
    if (!this.#worker) return
    await this.#request((id) => ({ type: 'release', id }))
  }

  /** Stops the worker at once; pending requests fail with `aborted`. */
  terminate(): void {
    this.#worker?.terminate()
    this.#worker = null
    this.#failAll(new WhisperWorkerError('aborted'))
  }

  #request(build: (id: number) => WorkerRequest, transfer: Transferable[] = [], onProgress?: (progress: DownloadProgress) => void) {
    const id = this.#nextId++
    const worker = this.#ensureWorker()
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, onProgress })
      worker.post(build(id), transfer)
    })
  }

  #ensureWorker(): WorkerPort {
    this.#worker ??= this.#createWorker(
      (data) => this.#onMessage(data),
      (message) => {
        this.#worker?.terminate()
        this.#worker = null
        this.#failAll(new WhisperWorkerError('unknown', message))
      },
    )
    return this.#worker
  }

  #onMessage(data: unknown) {
    if (!isWorkerResponse(data)) return
    const pending = this.#pending.get(data.id)
    if (!pending) return
    if (data.type === 'progress') {
      pending.onProgress?.({ loaded: data.loaded, total: data.total })
      return
    }
    this.#pending.delete(data.id)
    if (data.type === 'error') pending.reject(new WhisperWorkerError(data.code, data.message))
    else pending.resolve(data)
  }

  #failAll(error: WhisperWorkerError) {
    const pending = [...this.#pending.values()]
    this.#pending.clear()
    for (const request of pending) request.reject(error)
  }
}
