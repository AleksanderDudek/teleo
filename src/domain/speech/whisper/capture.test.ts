import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAudioContext, fakeCaptureEnvironment, FakeStream, resetFakeAudio } from '@/test/fakeAudio'
import { SpeechError } from '../SpeechEngine'
import { KEEP_WARM_MS, mediaErrorCode, Microphone } from './capture'

const RATE = 48_000
const quiet = (seconds: number) => new Float32Array(Math.round(seconds * RATE)).fill(0.001)
const voice = (seconds: number) =>
  Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => 0.2 * Math.sin((2 * Math.PI * 220 * i) / RATE))
const concat = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
const analyser = () => FakeAudioContext.instances.at(-1)!.analyser

beforeEach(() => {
  resetFakeAudio()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('mediaErrorCode', () => {
  it('maps getUserMedia failures to speech error codes', () => {
    const named = (name: string) => Object.assign(new Error(name), { name })
    expect(mediaErrorCode(named('NotAllowedError'))).toBe('permission-denied')
    expect(mediaErrorCode(named('SecurityError'))).toBe('permission-denied')
    expect(mediaErrorCode(named('NotFoundError'))).toBe('no-microphone')
    expect(mediaErrorCode(named('OverconstrainedError'))).toBe('no-microphone')
    expect(mediaErrorCode(named('NotReadableError'))).toBe('busy')
    expect(mediaErrorCode(new TypeError('getUserMedia is not a function'))).toBe('not-supported')
    expect(mediaErrorCode('weird')).toBe('unknown')
  })
})

describe('Microphone', () => {
  it('asks for one echo-cancelled, noise-suppressed channel', async () => {
    const { env, constraints } = fakeCaptureEnvironment()
    await new Microphone(env).start(() => {})
    expect(constraints).toEqual([{ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }])
  })

  it('rejects with a speech error when the microphone is blocked or missing', async () => {
    const blocked = fakeCaptureEnvironment({ getUserMedia: async () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })) })
    await expect(new Microphone(blocked.env).start(() => {})).rejects.toEqual(new SpeechError('permission-denied', 'no'))
    const missing = fakeCaptureEnvironment({ getUserMedia: async () => Promise.reject(Object.assign(new Error('none'), { name: 'NotFoundError' })) })
    await expect(new Microphone(missing.env).start(() => {})).rejects.toMatchObject({ code: 'no-microphone' })
  })

  it('reports the end of speech once, 1.5 s after the voice stops', async () => {
    const onSilence = vi.fn<() => void>()
    await new Microphone(fakeCaptureEnvironment().env).start(onSilence)
    analyser().level = 0.001
    await vi.advanceTimersByTimeAsync(500)
    analyser().level = 0.1
    await vi.advanceTimersByTimeAsync(1_000)
    analyser().level = 0.001
    await vi.advanceTimersByTimeAsync(1_400)
    expect(onSilence).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(onSilence).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onSilence).toHaveBeenCalledTimes(1)
  })

  it('gives up after 8 s without speech', async () => {
    const onSilence = vi.fn<() => void>()
    await new Microphone(fakeCaptureEnvironment().env).start(onSilence)
    await vi.advanceTimersByTimeAsync(7_950)
    expect(onSilence).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(onSilence).toHaveBeenCalledTimes(1)
  })

  it('returns the recording as 16 kHz mono and notices the speech in it', async () => {
    FakeAudioContext.decoded = { sampleRate: RATE, channels: [concat(quiet(0.5), voice(1), quiet(0.5)), concat(quiet(0.5), voice(1), quiet(0.5))] }
    const mic = new Microphone(fakeCaptureEnvironment().env)
    await mic.start(() => {})
    await vi.advanceTimersByTimeAsync(2_000)
    const result = await mic.stop()
    expect(result.samples).toHaveLength(32_000)
    expect(result.heardSpeech).toBe(true)
    expect(result.durationMs).toBe(2_000)
    expect(FakeAudioContext.instances[0]!.decodedBytes).toEqual([16])
  })

  it('resamples with OfflineAudioContext when the browser has it', async () => {
    FakeAudioContext.decoded = { sampleRate: RATE, channels: [voice(1)] }
    const mic = new Microphone(fakeCaptureEnvironment({ offline: true }).env)
    await mic.start(() => {})
    const { samples } = await mic.stop()
    expect(samples).toHaveLength(16_000)
    expect(samples.every((v) => v === 0.25)).toBe(true)
  })

  it('does not mistake a silent recording for speech', async () => {
    FakeAudioContext.decoded = { sampleRate: RATE, channels: [quiet(3)] }
    const mic = new Microphone(fakeCaptureEnvironment().env)
    await mic.start(() => {})
    expect((await mic.stop()).heardSpeech).toBe(false)
  })

  it('keeps the microphone open briefly for the next utterance, then releases it', async () => {
    const { env, streams } = fakeCaptureEnvironment()
    const mic = new Microphone(env)
    await mic.start(() => {})
    await mic.stop()
    await vi.advanceTimersByTimeAsync(KEEP_WARM_MS - 1_000)
    await mic.start(() => {})
    expect(streams).toHaveLength(1)
    await mic.stop()
    expect(streams[0]!.tracks[0]!.readyState).toBe('live')
    await vi.advanceTimersByTimeAsync(KEEP_WARM_MS)
    expect(streams[0]!.tracks[0]!.readyState).toBe('ended')
    expect(FakeAudioContext.instances[0]!.state).toBe('suspended')
  })

  it('asks again when the kept track has ended meanwhile', async () => {
    const { env, streams } = fakeCaptureEnvironment()
    const mic = new Microphone(env)
    await mic.start(() => {})
    await mic.stop()
    streams[0]!.tracks[0]!.stop()
    await mic.start(() => {})
    expect(streams).toHaveLength(2)
  })

  it('releases the microphone at once on abort and discards the recording', async () => {
    const { env, streams } = fakeCaptureEnvironment()
    const mic = new Microphone(env)
    const onSilence = vi.fn<() => void>()
    await mic.start(onSilence)
    mic.abort()
    expect(streams[0]!.tracks[0]!.readyState).toBe('ended')
    expect((await mic.stop()).samples).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onSilence).not.toHaveBeenCalled()
  })

  it('refuses a second recording at the same time', async () => {
    const mic = new Microphone(fakeCaptureEnvironment().env)
    await mic.start(() => {})
    await expect(mic.start(() => {})).rejects.toMatchObject({ code: 'busy' })
  })

  it('knows when the browser cannot record', () => {
    const { env } = fakeCaptureEnvironment()
    expect(new Microphone(env).supported).toBe(true)
    expect(new Microphone({ ...env, MediaRecorder: undefined }).supported).toBe(false)
    expect(new Microphone({ ...env, mediaDevices: undefined }).supported).toBe(false)
  })

  it('stops the stream when the recorder cannot start', async () => {
    const stream = new FakeStream()
    const { env } = fakeCaptureEnvironment({ getUserMedia: async () => stream })
    const Broken = class {
      constructor() {
        throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' })
      }
    }
    const mic = new Microphone({ ...env, MediaRecorder: Broken as unknown as typeof MediaRecorder })
    await expect(mic.start(() => {})).rejects.toMatchObject({ code: 'not-supported' })
    expect(stream.tracks[0]!.readyState).toBe('ended')
  })
})
