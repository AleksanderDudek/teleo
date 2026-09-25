import type { SpeechLang } from '@/domain/types'
import { SpeechError, type SpeechEngine, type SpeechErrorCode, type SpeechResult, type SpeechStartOptions } from './SpeechEngine'
import { bestTranscript, collapseCumulative, transcriptAlternatives, type ResultSnapshot } from './transcript'
import {
  getRecognitionCtor,
  isWebKitEngine,
  type AvailabilityStatus,
  type RecognitionCtorLike,
  type RecognitionLike,
  type RecognitionResultEventLike,
} from './webSpeechTypes'

export interface WebSpeechTimings {
  /** Quiet time after the last result that counts as "sentence finished". */
  silenceMs: number
  /** Tap mode: give up when nothing at all is heard for this long. */
  noSpeechMs: number
  /** Tap mode: hard cap for one utterance. */
  maxUtteranceMs: number
  /** Live mode: give up after this many consecutive restarts that heard nothing... */
  maxRapidRestarts: number
  /** ...and ended within this long after starting (a failing recogniser, not a phrase end). */
  rapidRestartMs: number
}

export const DEFAULT_TIMINGS: WebSpeechTimings = {
  silenceMs: 1500,
  noSpeechMs: 8000,
  maxUtteranceMs: 60_000,
  maxRapidRestarts: 3,
  rapidRestartMs: 1500,
}

const ERROR_CODES: Record<string, SpeechErrorCode> = {
  'not-allowed': 'permission-denied',
  'service-not-allowed': 'permission-denied',
  'audio-capture': 'no-microphone',
  network: 'network',
  'language-not-supported': 'language-not-supported',
}

interface Session {
  options: SpeechStartOptions
  recognition: RecognitionLike
  startedAt: number
  results: ResultSnapshot[]
  stopping: boolean
  onEnded?: () => void
  /** When the current recognition (re)started and whether it heard anything since. */
  runStartedAt: number
  heardSinceStart: boolean
  rapidRestarts: number
  timers: Set<ReturnType<typeof setTimeout>>
}

/**
 * Web Speech API engine (spec §5.2): Chrome/Edge/Safari. Continuous recognition
 * with interim results and 3 alternatives, a silence timer for sentence ends,
 * transparent restarts in live mode and on-device recognition when available.
 */
export class WebSpeechEngine implements SpeechEngine {
  readonly id = 'webspeech' as const
  readonly #timings: WebSpeechTimings
  readonly #scope: object
  readonly #webkit: boolean
  readonly #onDevice = new Map<SpeechLang, boolean>()
  #session: Session | null = null

  constructor(options: { timings?: Partial<WebSpeechTimings>; scope?: object; userAgent?: string } = {}) {
    this.#timings = { ...DEFAULT_TIMINGS, ...options.timings }
    this.#scope = options.scope ?? globalThis
    this.#webkit = isWebKitEngine(options.userAgent ?? globalThis.navigator?.userAgent ?? '')
  }

  #ctor(): RecognitionCtorLike | undefined {
    return getRecognitionCtor(this.#scope)
  }

  async isSupported(): Promise<boolean> {
    return this.#ctor() !== undefined
  }

  /** On-device status for a language, `undefined` when the browser cannot tell. */
  async onDeviceStatus(lang: SpeechLang): Promise<AvailabilityStatus | undefined> {
    const available = this.#ctor()?.available
    if (!available) return undefined
    try {
      return await available({ langs: [lang], processLocally: true })
    } catch {
      return undefined
    }
  }

  /** Downloads the on-device language pack (call from a user gesture). */
  async installOnDevice(lang: SpeechLang): Promise<boolean> {
    const install = this.#ctor()?.install
    if (!install) return false
    try {
      const ok = await install({ langs: [lang], processLocally: true })
      if (ok) this.#onDevice.set(lang, true)
      return ok
    } catch {
      return false
    }
  }

  async #prefersOnDevice(lang: SpeechLang): Promise<boolean> {
    const cached = this.#onDevice.get(lang)
    if (cached !== undefined) return cached
    const onDevice = (await this.onDeviceStatus(lang)) === 'available'
    this.#onDevice.set(lang, onDevice)
    return onDevice
  }

  async start(options: SpeechStartOptions): Promise<void> {
    if (this.#session) throw new SpeechError('busy')
    const Ctor = this.#ctor()
    if (!Ctor) throw new SpeechError('not-supported')
    const onDevice = await this.#prefersOnDevice(options.lang)
    const recognition = new Ctor()
    recognition.lang = options.lang
    recognition.continuous = true // a single-shot session cuts long sentences short (spec §5.2)
    recognition.interimResults = true
    recognition.maxAlternatives = 3
    if (onDevice && 'processLocally' in recognition) recognition.processLocally = true

    const session: Session = {
      options,
      recognition,
      startedAt: Date.now(),
      results: [],
      stopping: false,
      runStartedAt: Date.now(),
      heardSinceStart: false,
      rapidRestarts: 0,
      timers: new Set(),
    }
    this.#session = session

    await new Promise<void>((resolve, reject) => {
      let started = false
      recognition.onstart = () => {
        started = true
        resolve()
        if (!options.continuous) this.#arm(session, 'noSpeech')
        if (!options.continuous) this.#arm(session, 'max')
      }
      recognition.onresult = (event) => this.#onResult(session, event)
      recognition.onerror = (event) => {
        const code = ERROR_CODES[event.error]
        if (event.error === 'no-speech' || event.error === 'aborted') return // handled by onend
        const error = new SpeechError(code ?? 'unknown', event.message || event.error)
        if (!started) {
          this.#teardown(session)
          reject(error)
        } else if (code === 'permission-denied' || code === 'no-microphone') {
          this.#teardown(session)
          options.onError?.(error)
        } else {
          options.onError?.(error)
        }
      }
      recognition.onend = () => this.#onEnd(session)
      try {
        recognition.start()
      } catch (cause) {
        this.#teardown(session)
        reject(new SpeechError('busy', String(cause)))
      }
    })
  }

  #arm(session: Session, kind: 'silence' | 'noSpeech' | 'max') {
    const ms =
      kind === 'silence' ? this.#timings.silenceMs : kind === 'noSpeech' ? this.#timings.noSpeechMs : this.#timings.maxUtteranceMs
    const timer = setTimeout(() => {
      session.timers.delete(timer)
      if (this.#session === session && !session.stopping) session.options.onSilence?.()
    }, ms)
    session.timers.add(timer)
    return timer
  }

  #onResult(session: Session, event: RecognitionResultEventLike) {
    if (this.#session !== session) return
    const snapshots: ResultSnapshot[] = []
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result) continue
      const alternatives: string[] = []
      for (let k = 0; k < result.length; k++) {
        const alt = result[k]
        if (alt) alternatives.push(alt.transcript)
      }
      snapshots.push({ alternatives, isFinal: result.isFinal })
    }
    session.results = this.#webkit ? collapseCumulative(snapshots) : snapshots
    session.heardSinceStart = true
    // Any speech cancels the "nothing heard" timer; the silence timer restarts on every result.
    for (const timer of session.timers) clearTimeout(timer)
    session.timers.clear()
    if (!session.options.continuous) this.#arm(session, 'max')
    this.#arm(session, 'silence')
    const text = bestTranscript(session.results)
    session.options.onTranscript?.(text, session.results.every((r) => r.isFinal))
  }

  #onEnd(session: Session) {
    if (this.#session !== session) return
    if (session.stopping) {
      session.onEnded?.()
      return
    }
    if (session.options.continuous) {
      // The browser ended recognition on its own (phrase end on iOS, time limit, network blip):
      // resume listening. Only quick ends that heard nothing count as failures.
      const now = Date.now()
      const rapid = !session.heardSinceStart && now - session.runStartedAt < this.#timings.rapidRestartMs
      session.rapidRestarts = rapid ? session.rapidRestarts + 1 : 0
      if (session.rapidRestarts < this.#timings.maxRapidRestarts) {
        session.results = []
        session.runStartedAt = now
        session.heardSinceStart = false
        session.options.onRestart?.()
        try {
          session.recognition.start()
          return
        } catch {
          // fall through to the error below
        }
      }
      this.#teardown(session)
      session.options.onError?.(new SpeechError('network', 'Speech recognition stopped repeatedly'))
      return
    }
    // Tap mode: recognition ended before we asked (e.g. "no-speech"); report it as silence.
    session.options.onSilence?.()
  }

  async stop(): Promise<SpeechResult> {
    const session = this.#session
    if (!session) return { alternatives: [], durationMs: 0, engine: this.id }
    session.stopping = true
    for (const timer of session.timers) clearTimeout(timer)
    session.timers.clear()
    await new Promise<void>((resolve) => {
      const fallback = setTimeout(() => {
        session.recognition.abort()
        resolve()
      }, 2500)
      session.onEnded = () => {
        clearTimeout(fallback)
        resolve()
      }
      try {
        session.recognition.stop()
      } catch {
        clearTimeout(fallback)
        resolve()
      }
    })
    const result: SpeechResult = {
      alternatives: transcriptAlternatives(session.results),
      durationMs: Date.now() - session.startedAt,
      engine: this.id,
    }
    this.#teardown(session)
    return result
  }

  abort(): void {
    const session = this.#session
    if (!session) return
    session.stopping = true
    this.#teardown(session)
    try {
      session.recognition.abort()
    } catch {
      // already stopped
    }
  }

  #teardown(session: Session) {
    for (const timer of session.timers) clearTimeout(timer)
    session.timers.clear()
    session.recognition.onresult = null
    session.recognition.onerror = null
    session.recognition.onstart = null
    if (this.#session === session) this.#session = null
  }
}
