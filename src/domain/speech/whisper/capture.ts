import { SpeechError, type SpeechErrorCode } from '../SpeechEngine'
import { downmix, resample } from './resample'
import { containsSpeech, createSilenceDetector, rms, type SilenceConfig } from './silence'
import { WHISPER_SAMPLE_RATE } from './transcribe'

/**
 * Microphone capture for the offline engine (spec §5.3): MediaRecorder keeps
 * the audio, an AnalyserNode feeds the silence detector, and on stop the
 * recording is decoded and converted to 16 kHz mono for Whisper.
 */

/** The stream stays open this long after an utterance, so the next one (hands-free) starts at once. */
export const KEEP_WARM_MS = 8_000
const FRAME_MS = 50
const RECORDER_STOP_TIMEOUT_MS = 3_000

export interface CaptureEnvironment {
  mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined
  MediaRecorder: typeof MediaRecorder | undefined
  AudioContext: typeof AudioContext | undefined
  OfflineAudioContext: typeof OfflineAudioContext | undefined
  now: () => number
}

type LegacyScope = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
  webkitOfflineAudioContext?: typeof OfflineAudioContext
}

export function browserCaptureEnvironment(scope: typeof globalThis = globalThis): CaptureEnvironment {
  const legacy = scope as LegacyScope
  return {
    mediaDevices: scope.navigator?.mediaDevices,
    MediaRecorder: scope.MediaRecorder,
    AudioContext: scope.AudioContext ?? legacy.webkitAudioContext,
    OfflineAudioContext: scope.OfflineAudioContext ?? legacy.webkitOfflineAudioContext,
    now: () => Date.now(),
  }
}

/** getUserMedia / MediaRecorder failures → codes the UI explains. */
export function mediaErrorCode(error: unknown): SpeechErrorCode {
  switch (error instanceof Error ? error.name : '') {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'permission-denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-microphone'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy'
    case 'TypeError':
      return 'not-supported'
    default:
      return 'unknown'
  }
}

export interface CaptureResult {
  /** 16 kHz mono PCM. */
  samples: Float32Array
  durationMs: number
  /** Whether the recording contains speech at all (checked on the audio itself). */
  heardSpeech: boolean
}

interface Input {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
}

interface Session {
  recorder: MediaRecorder
  chunks: Blob[]
  startedAt: number
  poll: ReturnType<typeof setInterval>
}

function stopRecorder(recorder: MediaRecorder, chunks: Blob[]): Promise<Blob> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      resolve(new Blob(chunks, { type: recorder.mimeType }))
    }
    const timer = setTimeout(done, RECORDER_STOP_TIMEOUT_MS)
    recorder.onstop = done
    try {
      if (recorder.state === 'inactive') done()
      else recorder.stop()
    } catch {
      done()
    }
  })
}

/** One recording at a time; the AudioContext lives as long as the engine (created on the first tap). */
export class Microphone {
  readonly #env: CaptureEnvironment
  readonly #silence: Partial<SilenceConfig>
  #context: AudioContext | null = null
  #input: Input | null = null
  #session: Session | null = null
  #starting = false
  #releaseTimer: ReturnType<typeof setTimeout> | undefined

  constructor(env: CaptureEnvironment = browserCaptureEnvironment(), options: { silence?: Partial<SilenceConfig> } = {}) {
    this.#env = env
    this.#silence = options.silence ?? {}
  }

  get supported(): boolean {
    return typeof this.#env.mediaDevices?.getUserMedia === 'function' && !!this.#env.MediaRecorder && !!this.#env.AudioContext
  }

  /** Opens the microphone and starts recording; `onSilence` fires once when the utterance seems over. */
  async start(onSilence: () => void): Promise<void> {
    if (this.#session || this.#starting) throw new SpeechError('busy')
    const Recorder = this.#env.MediaRecorder
    if (!this.supported || !Recorder) throw new SpeechError('not-supported')
    this.#starting = true
    try {
      const input = await this.#acquire()
      const chunks: Blob[] = []
      let recorder: MediaRecorder
      try {
        recorder = new Recorder(input.stream)
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        recorder.start()
      } catch (cause) {
        this.#release()
        throw new SpeechError('not-supported', cause instanceof Error ? cause.message : String(cause))
      }
      const detector = createSilenceDetector(this.#silence)
      const frame = new Float32Array(input.analyser.fftSize)
      const session: Session = { recorder, chunks, startedAt: this.#env.now(), poll: setInterval(() => sample(), FRAME_MS) }
      const sample = () => {
        if (this.#session !== session) return
        input.analyser.getFloatTimeDomainData(frame)
        if (detector.push(rms(frame), this.#env.now())) {
          clearInterval(session.poll)
          onSilence()
        }
      }
      this.#session = session
      sample()
    } finally {
      this.#starting = false
    }
  }

  /** Stops recording; the microphone stays warm for {@link KEEP_WARM_MS}. */
  async stop(): Promise<CaptureResult> {
    const session = this.#session
    if (!session) return { samples: new Float32Array(0), durationMs: 0, heardSpeech: false }
    this.#session = null
    clearInterval(session.poll)
    const durationMs = this.#env.now() - session.startedAt
    const blob = await stopRecorder(session.recorder, session.chunks)
    this.#releaseSoon()
    const samples = await this.#toMono16k(blob)
    return { samples, durationMs, heardSpeech: containsSpeech(samples, WHISPER_SAMPLE_RATE) }
  }

  /** Discards the recording and closes the microphone at once. */
  abort(): void {
    const session = this.#session
    this.#session = null
    if (session) {
      clearInterval(session.poll)
      session.recorder.ondataavailable = null
      session.recorder.onstop = null
      try {
        if (session.recorder.state !== 'inactive') session.recorder.stop()
      } catch {
        // already stopped
      }
    }
    this.#release()
  }

  async #acquire(): Promise<Input> {
    clearTimeout(this.#releaseTimer)
    const warm = this.#input
    if (warm && warm.stream.getTracks().every((track) => track.readyState === 'live')) {
      this.#resume()
      return warm
    }
    this.#release()
    let stream: MediaStream
    try {
      stream = await this.#env.mediaDevices!.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    } catch (error) {
      throw new SpeechError(mediaErrorCode(error), error instanceof Error ? error.message : String(error))
    }
    try {
      const context = this.#ensureContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      this.#input = { stream, source, analyser }
    } catch (error) {
      for (const track of stream.getTracks()) track.stop()
      throw new SpeechError('not-supported', error instanceof Error ? error.message : String(error))
    }
    this.#resume()
    return this.#input
  }

  #ensureContext(): AudioContext {
    this.#context ??= new this.#env.AudioContext!()
    return this.#context
  }

  /** Not awaited: without a user gesture some browsers never settle `resume()`; the recording works regardless. */
  #resume() {
    void this.#context?.resume().catch(() => {})
  }

  #releaseSoon() {
    clearTimeout(this.#releaseTimer)
    void this.#context?.suspend().catch(() => {})
    this.#releaseTimer = setTimeout(() => this.#release(), KEEP_WARM_MS)
  }

  #release() {
    clearTimeout(this.#releaseTimer)
    const input = this.#input
    this.#input = null
    if (!input) return
    input.source.disconnect()
    for (const track of input.stream.getTracks()) track.stop()
    void this.#context?.suspend().catch(() => {})
  }

  async #toMono16k(blob: Blob): Promise<Float32Array> {
    if (blob.size === 0) return new Float32Array(0)
    const audio = await this.#ensureContext().decodeAudioData(await blob.arrayBuffer())
    const Offline = this.#env.OfflineAudioContext
    if (Offline) {
      try {
        const offline = new Offline(1, Math.max(1, Math.ceil(audio.duration * WHISPER_SAMPLE_RATE)), WHISPER_SAMPLE_RATE)
        const source = offline.createBufferSource()
        source.buffer = audio
        source.connect(offline.destination)
        source.start()
        return (await offline.startRendering()).getChannelData(0).slice()
      } catch {
        // e.g. old Safari renders only at ≥ 22.05 kHz: use the JS resampler below
      }
    }
    const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel))
    return resample(downmix(channels), audio.sampleRate, WHISPER_SAMPLE_RATE)
  }
}
