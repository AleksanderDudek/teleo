import { describe, expect, it, vi } from 'vitest'
import { SpeechError } from './SpeechEngine'
import type { CaptureResult } from './whisper/capture'
import { WhisperWorkerError } from './whisper/client'
import type { WhisperModelId } from './whisper/models'
import { WhisperEngine, type WhisperEngineDeps } from './WhisperEngine'

function setup(options: { downloaded?: WhisperModelId[]; platform?: boolean; capture?: Partial<CaptureResult>; transcript?: string } = {}) {
  type Client = WhisperEngineDeps['client']
  type Mic = WhisperEngineDeps['microphone']
  let onSilence: (() => void) | undefined
  const deps = {
    platformSupported: vi.fn<WhisperEngineDeps['platformSupported']>(() => options.platform ?? true),
    isDownloaded: vi.fn<WhisperEngineDeps['isDownloaded']>(async (model) => (options.downloaded ?? ['base']).includes(model)),
    client: {
      prepare: vi.fn<Client['prepare']>(async () => 'wasm'),
      transcribe: vi.fn<Client['transcribe']>(async () => options.transcript ?? ' Dzień dobry. '),
    },
    microphone: {
      supported: true,
      start: vi.fn<Mic['start']>(async (callback) => {
        onSilence = callback
      }),
      stop: vi.fn<Mic['stop']>(async () => ({ samples: new Float32Array(8), durationMs: 1_200, heardSpeech: true, ...options.capture })),
      abort: vi.fn<Mic['abort']>(),
    },
  } satisfies WhisperEngineDeps
  return { engine: new WhisperEngine(deps), deps, silence: () => onSilence?.() }
}

describe('WhisperEngine', () => {
  it('is supported only when the browser can run it and the chosen model is downloaded', async () => {
    expect(await setup().engine.isSupported()).toBe(true)
    expect(await setup({ downloaded: [] }).engine.isSupported()).toBe(false)
    expect(await setup({ platform: false }).engine.isSupported()).toBe(false)
    const { engine } = setup({ downloaded: ['base'] })
    engine.useModel('tiny')
    expect(await engine.isSupported()).toBe(false)
  })

  it('refuses to start without a downloaded model, before touching the microphone', async () => {
    const { engine, deps } = setup({ downloaded: [] })
    await expect(engine.start({ lang: 'pl-PL' })).rejects.toEqual(new SpeechError('model-missing'))
    expect(deps.microphone.start).not.toHaveBeenCalled()
  })

  it('refuses to start in a browser that cannot run Whisper', async () => {
    await expect(setup({ platform: false }).engine.start({ lang: 'pl-PL' })).rejects.toMatchObject({ code: 'not-supported' })
  })

  it('loads the model while the user speaks and relays the silence signal', async () => {
    const onSilence = vi.fn<() => void>()
    const { engine, deps, silence } = setup()
    await engine.start({ lang: 'pl-PL', onSilence })
    expect(deps.client.prepare).toHaveBeenCalledWith('base', { download: false })
    silence()
    expect(onSilence).toHaveBeenCalledTimes(1)
  })

  it('transcribes the recording in the language of the text', async () => {
    const { engine, deps } = setup()
    await engine.start({ lang: 'en-US' })
    const result = await engine.stop()
    expect(deps.client.transcribe).toHaveBeenCalledWith('base', 'en-US', expect.any(Float32Array))
    expect(result).toEqual({ alternatives: ['Dzień dobry.'], durationMs: 1_200, engine: 'whisper' })
  })

  it('returns an empty result without transcribing when nothing was said', async () => {
    const { engine, deps } = setup({ capture: { heardSpeech: false, durationMs: 8_000 } })
    await engine.start({ lang: 'pl-PL' })
    expect(await engine.stop()).toEqual({ alternatives: [], durationMs: 8_000, engine: 'whisper' })
    expect(deps.client.transcribe).not.toHaveBeenCalled()
  })

  it('returns an empty result when Whisper hears only noise', async () => {
    const { engine } = setup({ transcript: ' [BLANK_AUDIO]' })
    await engine.start({ lang: 'pl-PL' })
    expect((await engine.stop()).alternatives).toEqual([])
  })

  it('is safe to stop when idle', async () => {
    expect(await setup().engine.stop()).toEqual({ alternatives: [], durationMs: 0, engine: 'whisper' })
  })

  it('rejects with model-missing when the model vanished from the cache', async () => {
    const { engine, deps } = setup()
    deps.client.prepare.mockRejectedValueOnce(new WhisperWorkerError('model-missing', 'gone'))
    await engine.start({ lang: 'pl-PL' })
    await expect(engine.stop()).rejects.toMatchObject({ code: 'model-missing' })
  })

  it('reports other recognition failures as unknown', async () => {
    const { engine, deps } = setup()
    deps.client.transcribe.mockRejectedValueOnce(new WhisperWorkerError('unknown', 'onnx exploded'))
    await engine.start({ lang: 'pl-PL' })
    await expect(engine.stop()).rejects.toMatchObject({ code: 'unknown' })
  })

  it('passes microphone errors through', async () => {
    const { engine, deps } = setup()
    deps.microphone.start.mockRejectedValueOnce(new SpeechError('permission-denied'))
    await expect(engine.start({ lang: 'pl-PL' })).rejects.toMatchObject({ code: 'permission-denied' })
    await engine.start({ lang: 'pl-PL' })
  })

  it('refuses a second session while one is running', async () => {
    const { engine } = setup()
    await engine.start({ lang: 'pl-PL' })
    await expect(engine.start({ lang: 'pl-PL' })).rejects.toMatchObject({ code: 'busy' })
  })

  it('aborts: closes the microphone and ignores a late silence signal', async () => {
    const onSilence = vi.fn<() => void>()
    const { engine, deps, silence } = setup()
    await engine.start({ lang: 'pl-PL', onSilence })
    engine.abort()
    silence()
    expect(deps.microphone.abort).toHaveBeenCalled()
    expect(onSilence).not.toHaveBeenCalled()
    expect((await engine.stop()).alternatives).toEqual([])
  })

  it('uses the model chosen in Settings', async () => {
    const { engine, deps } = setup({ downloaded: ['tiny', 'base'] })
    engine.useModel('tiny')
    await engine.start({ lang: 'pl-PL' })
    await engine.stop()
    expect(deps.client.prepare).toHaveBeenCalledWith('tiny', { download: false })
    expect(deps.client.transcribe).toHaveBeenCalledWith('tiny', 'pl-PL', expect.any(Float32Array))
  })

  it('always recognises on the device', async () => {
    expect(await setup().engine.onDeviceStatus()).toBe('available')
  })
})
