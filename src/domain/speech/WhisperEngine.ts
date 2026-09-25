import type { SpeechLang } from '@/domain/types'
import { SpeechError, type OnDeviceStatus, type SpeechEngine, type SpeechResult, type SpeechStartOptions } from './SpeechEngine'
import type { CaptureResult } from './whisper/capture'
import { WhisperWorkerError } from './whisper/client'
import type { WhisperModelId } from './whisper/models'
import type { WhisperDevice } from './whisper/protocol'
import { cleanTranscript } from './whisper/transcribe'

export interface WhisperEngineDeps {
  /** Web Workers, Cache Storage and WebAssembly exist (the model may still be missing). */
  platformSupported: () => boolean
  /** Model files and runtime are in Cache Storage. */
  isDownloaded: (model: WhisperModelId) => Promise<boolean>
  client: {
    prepare(model: WhisperModelId, options: { download: false }): Promise<WhisperDevice>
    transcribe(model: WhisperModelId, lang: SpeechLang, audio: Float32Array): Promise<string>
  }
  microphone: {
    readonly supported: boolean
    start(onSilence: () => void): Promise<void>
    stop(): Promise<CaptureResult>
    abort(): void
  }
}

interface Session {
  options: SpeechStartOptions
  model: WhisperModelId
  prepared: Promise<unknown>
}

const toSpeechError = (error: unknown): SpeechError => {
  if (error instanceof SpeechError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof WhisperWorkerError && error.code === 'model-missing') return new SpeechError('model-missing', message)
  return new SpeechError('unknown', message)
}

/**
 * Offline recognition with Whisper (spec §5.3): records one utterance, then
 * transcribes it in a worker — no interim text, so the player uses tap mode
 * (with the hands-free auto-listen fallback). Audio never leaves the device.
 * `stop()` rejects with a {@link SpeechError} when recognition itself fails.
 */
export class WhisperEngine implements SpeechEngine {
  readonly id = 'whisper' as const
  readonly #deps: WhisperEngineDeps
  #model: WhisperModelId = 'base'
  #session: Session | null = null
  #starting = false

  constructor(deps: WhisperEngineDeps) {
    this.#deps = deps
  }

  get model(): WhisperModelId {
    return this.#model
  }

  /** The model chosen in Settings. */
  useModel(model: WhisperModelId): void {
    this.#model = model
  }

  /** This browser can run Whisper at all (the model may still need downloading). */
  canRun(): boolean {
    return this.#deps.platformSupported() && this.#deps.microphone.supported
  }

  async isSupported(): Promise<boolean> {
    return this.canRun() && (await this.#isDownloaded(this.#model))
  }

  async #isDownloaded(model: WhisperModelId): Promise<boolean> {
    try {
      return await this.#deps.isDownloaded(model)
    } catch {
      return false
    }
  }

  async start(options: SpeechStartOptions): Promise<void> {
    if (this.#session || this.#starting) throw new SpeechError('busy')
    if (!this.canRun()) throw new SpeechError('not-supported')
    this.#starting = true
    try {
      const model = this.#model
      if (!(await this.#isDownloaded(model))) throw new SpeechError('model-missing')
      // Load the model while the user speaks; a failure surfaces in stop().
      const prepared = this.#deps.client.prepare(model, { download: false })
      prepared.catch(() => {})
      const session: Session = { options, model, prepared }
      this.#session = session
      try {
        await this.#deps.microphone.start(() => {
          if (this.#session === session) options.onSilence?.()
        })
      } catch (error) {
        if (this.#session === session) this.#session = null
        throw toSpeechError(error)
      }
    } finally {
      this.#starting = false
    }
  }

  async stop(): Promise<SpeechResult> {
    const session = this.#session
    if (!session) return { alternatives: [], durationMs: 0, engine: this.id }
    this.#session = null
    try {
      const capture = await this.#deps.microphone.stop()
      // Never transcribe silence: Whisper hallucinates on it ("Napisy stworzone przez…").
      if (!capture.heardSpeech) return { alternatives: [], durationMs: capture.durationMs, engine: this.id }
      await session.prepared
      const text = cleanTranscript(await this.#deps.client.transcribe(session.model, session.options.lang, capture.samples))
      return { alternatives: text ? [text] : [], durationMs: capture.durationMs, engine: this.id }
    } catch (error) {
      throw toSpeechError(error)
    }
  }

  abort(): void {
    this.#session = null
    this.#deps.microphone.abort()
  }

  /** Whisper always runs on this device. */
  async onDeviceStatus(): Promise<OnDeviceStatus> {
    return 'available'
  }
}
