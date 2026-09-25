import type { CaptureEnvironment } from '@/domain/speech/whisper/capture'

/** Scriptable stand-ins for the browser audio APIs the Whisper capture uses (unit tests). */
export class FakeTrack {
  readyState: 'live' | 'ended' = 'live'
  stop() {
    this.readyState = 'ended'
  }
}

export class FakeStream {
  readonly tracks = [new FakeTrack()]
  getTracks() {
    return this.tracks
  }
}

export class FakeRecorder {
  static instances: FakeRecorder[] = []
  /** What the next recording "contains" (handed to `decodeAudioData`). */
  static nextChunks: Blob[] = [new Blob([new Uint8Array(16)])]
  readonly stream: FakeStream
  mimeType = 'audio/webm;codecs=opus'
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: FakeStream) {
    this.stream = stream
    FakeRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    queueMicrotask(() => {
      for (const data of FakeRecorder.nextChunks) this.ondataavailable?.({ data })
      this.onstop?.()
    })
  }
}

/** Constant signal whose RMS is `level`. */
export class FakeAnalyser {
  fftSize = 2048
  level = 0
  getFloatTimeDomainData(buffer: Float32Array) {
    buffer.fill(this.level)
  }
}

export interface DecodedAudio {
  sampleRate: number
  channels: Float32Array[]
}

export function fakeAudioBuffer({ sampleRate, channels }: DecodedAudio) {
  const length = channels[0]?.length ?? 0
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: length / sampleRate,
    getChannelData: (channel: number) => channels[channel]!,
  }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  /** What `decodeAudioData` returns. */
  static decoded: DecodedAudio = { sampleRate: 48_000, channels: [new Float32Array(48_000)] }
  readonly analyser = new FakeAnalyser()
  readonly sampleRate = 48_000
  state: 'running' | 'suspended' | 'closed' = 'running'
  decodedBytes: number[] = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }

  createAnalyser() {
    return this.analyser
  }

  async decodeAudioData(data: ArrayBuffer) {
    this.decodedBytes.push(data.byteLength)
    return fakeAudioBuffer(FakeAudioContext.decoded)
  }

  async resume() {
    this.state = 'running'
  }

  async suspend() {
    this.state = 'suspended'
  }

  async close() {
    this.state = 'closed'
  }
}

/** Renders every input as a constant 0.25 signal of the requested length (proves the offline path ran). */
export class FakeOfflineAudioContext {
  readonly length: number
  readonly sampleRate: number
  readonly destination = {}

  constructor(_channels: number, length: number, sampleRate: number) {
    this.length = length
    this.sampleRate = sampleRate
  }

  createBufferSource() {
    return { buffer: null as unknown, connect() {}, start() {} }
  }

  async startRendering() {
    return fakeAudioBuffer({ sampleRate: this.sampleRate, channels: [new Float32Array(this.length).fill(0.25)] })
  }
}

export function fakeCaptureEnvironment(options: { offline?: boolean; getUserMedia?: () => Promise<FakeStream> } = {}) {
  const streams: FakeStream[] = []
  const constraints: MediaStreamConstraints[] = []
  const env = {
    mediaDevices: {
      getUserMedia: async (request: MediaStreamConstraints) => {
        constraints.push(request)
        const stream = options.getUserMedia ? await options.getUserMedia() : new FakeStream()
        streams.push(stream)
        return stream
      },
    },
    MediaRecorder: FakeRecorder,
    AudioContext: FakeAudioContext,
    OfflineAudioContext: options.offline ? FakeOfflineAudioContext : undefined,
    now: () => Date.now(),
  } as unknown as CaptureEnvironment
  return { env, streams, constraints }
}

export function resetFakeAudio() {
  FakeRecorder.instances = []
  FakeRecorder.nextChunks = [new Blob([new Uint8Array(16)])]
  FakeAudioContext.instances = []
  FakeAudioContext.decoded = { sampleRate: 48_000, channels: [new Float32Array(48_000)] }
}
