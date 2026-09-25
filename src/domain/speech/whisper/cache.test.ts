import { describe, expect, it, vi } from 'vitest'
import { FakeCacheStorage } from '@/test/fakeCaches'
import { deleteModel, inspectModel, loadRuntimeFile, MODEL_CACHE, pruneRuntime } from './cache'
import { modelBytes, modelFileUrls, WHISPER_MODELS, type WhisperModelId } from './models'
import { ORT_CACHE, ortRuntime } from './runtime'

const runtime = ortRuntime({ base: '/teleo/', version: '1.31.0', legacySafari: false })

function seedModel(caches: FakeCacheStorage, model: WhisperModelId) {
  for (const url of modelFileUrls(model)) caches.cache(MODEL_CACHE).seed(url)
}
function seedRuntime(caches: FakeCacheStorage) {
  for (const url of runtime.urls) caches.cache(ORT_CACHE).seed(url)
}

describe('inspectModel', () => {
  it('needs the whole download in a fresh browser, without creating caches', async () => {
    const caches = new FakeCacheStorage()
    expect(await inspectModel('base', { caches, runtime })).toEqual({ ready: false, missingBytes: modelBytes('base') + runtime.bytes })
    expect(caches.caches.size).toBe(0)
  })

  it('is ready when every model file and the runtime are cached', async () => {
    const caches = new FakeCacheStorage()
    seedModel(caches, 'base')
    seedRuntime(caches)
    expect(await inspectModel('base', { caches, runtime })).toEqual({ ready: true, missingBytes: 0 })
    expect((await inspectModel('tiny', { caches, runtime })).ready).toBe(false)
  })

  it('counts only what is missing', async () => {
    const caches = new FakeCacheStorage()
    seedModel(caches, 'tiny')
    expect(await inspectModel('tiny', { caches, runtime })).toEqual({ ready: false, missingBytes: runtime.bytes })

    const encoder = WHISPER_MODELS.tiny.files.find((f) => f.path === 'onnx/encoder_model_quantized.onnx')!
    await caches.cache(MODEL_CACHE).delete(modelFileUrls('tiny').find((url) => url.endsWith(encoder.path))!)
    seedRuntime(caches)
    expect(await inspectModel('tiny', { caches, runtime })).toEqual({ ready: false, missingBytes: encoder.bytes })
  })
})

describe('deleteModel', () => {
  it('removes the model files but keeps the runtime while another model still uses it', async () => {
    const caches = new FakeCacheStorage()
    seedModel(caches, 'tiny')
    seedModel(caches, 'base')
    seedRuntime(caches)
    await deleteModel('base', { caches, runtime })
    expect((await inspectModel('base', { caches, runtime })).ready).toBe(false)
    expect(await inspectModel('tiny', { caches, runtime })).toEqual({ ready: true, missingBytes: 0 })
  })

  it('removes the runtime together with the last model', async () => {
    const caches = new FakeCacheStorage()
    seedModel(caches, 'base')
    seedRuntime(caches)
    await deleteModel('base', { caches, runtime })
    expect(await caches.has(ORT_CACHE)).toBe(false)
    expect(caches.cache(MODEL_CACHE).entries.size).toBe(0)
  })
})

describe('loadRuntimeFile', () => {
  const url = runtime.wasm

  it('reads a cached file without touching the network', async () => {
    const caches = new FakeCacheStorage()
    caches.cache(ORT_CACHE).seed(url, 8)
    const fetch = vi.fn<typeof globalThis.fetch>()
    const bytes = await loadRuntimeFile(url, { caches, fetch, allowNetwork: true, expectedBytes: 8 })
    expect(bytes.byteLength).toBe(8)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('downloads, reports progress and caches a missing file when allowed', async () => {
    const caches = new FakeCacheStorage()
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(new Uint8Array(1_000), { headers: { 'content-type': 'application/wasm' } }))
    const onProgress = vi.fn<(loaded: number, total: number) => void>()
    const bytes = await loadRuntimeFile(url, { caches, fetch, allowNetwork: true, expectedBytes: 1_000, onProgress })
    expect(bytes.byteLength).toBe(1_000)
    expect(onProgress).toHaveBeenLastCalledWith(1_000, 1_000)
    const cached = await caches.cache(ORT_CACHE).match(url)
    expect(cached?.headers.get('content-type')).toBe('application/wasm')
    expect((await cached!.arrayBuffer()).byteLength).toBe(1_000)
  })

  it('never downloads when the network is not allowed', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expect(loadRuntimeFile(url, { caches: new FakeCacheStorage(), fetch, allowNetwork: false, expectedBytes: 1 })).rejects.toMatchObject({
      name: 'ModelFileNotFoundError',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails on HTTP errors', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('missing', { status: 404 }))
    await expect(loadRuntimeFile(url, { caches: new FakeCacheStorage(), fetch, allowNetwork: true, expectedBytes: 1 })).rejects.toThrow(/404/)
  })
})

describe('pruneRuntime', () => {
  it('deletes runtime files of other versions', async () => {
    const caches = new FakeCacheStorage()
    seedRuntime(caches)
    caches.cache(ORT_CACHE).seed('/teleo/ort/1.30.0/ort-wasm-simd-threaded.asyncify.wasm')
    await pruneRuntime({ caches, runtime })
    expect(await caches.cache(ORT_CACHE).keys()).toEqual([{ url: new URL(runtime.wasm, 'https://teleo.test/').href }])
  })

  it('does nothing without a runtime cache', async () => {
    const caches = new FakeCacheStorage()
    await pruneRuntime({ caches, runtime })
    expect(caches.caches.size).toBe(0)
  })
})
