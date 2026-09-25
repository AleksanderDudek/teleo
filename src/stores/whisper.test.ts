import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MODEL_CACHE } from '@/domain/speech/whisper/cache'
import { WhisperWorkerError } from '@/domain/speech/whisper/client'
import { modelBytes, modelFileUrls, type WhisperModelId } from '@/domain/speech/whisper/models'
import type { DownloadProgress } from '@/domain/speech/whisper/progress'
import type { WhisperDevice } from '@/domain/speech/whisper/protocol'
import { ORT_CACHE, ortRuntime } from '@/domain/speech/whisper/runtime'
import { FakeCacheStorage } from '@/test/fakeCaches'
import { createWhisperManager, useWhisperStore, type WhisperManagerDeps } from './whisper'

const runtime = ortRuntime({ base: '/teleo/', version: '1.31.0', legacySafari: false })

function seed(caches: FakeCacheStorage, model: WhisperModelId) {
  for (const url of modelFileUrls(model)) caches.cache(MODEL_CACHE).seed(url)
  for (const url of runtime.urls) caches.cache(ORT_CACHE).seed(url)
}

function setup(options: { canRun?: boolean; freeBytes?: number } = {}) {
  const caches = new FakeCacheStorage()
  type Client = WhisperManagerDeps['client']
  const deps = {
    canRun: () => options.canRun ?? true,
    storage: () => ({ caches, runtime }),
    estimate: async () => (options.freeBytes === undefined ? undefined : { quota: options.freeBytes, usage: 0 }),
    persist: vi.fn<() => Promise<boolean>>(async () => true),
    client: {
      // A successful download: reports progress, then the files are in the cache.
      prepare: vi.fn<Client['prepare']>(async (model, { onProgress }) => {
        onProgress?.({ loaded: 50, total: 100 })
        seed(caches, model)
        return 'wasm'
      }),
      release: vi.fn<Client['release']>(async () => {}),
      terminate: vi.fn<Client['terminate']>(),
    },
  } satisfies WhisperManagerDeps
  return { caches, deps, manager: createWhisperManager(deps) }
}

const state = (model: WhisperModelId) => useWhisperStore.getState().models[model]

beforeEach(() => useWhisperStore.setState(useWhisperStore.getInitialState()))

describe('whisper model manager', () => {
  it('marks every model unavailable when the browser cannot run Whisper', async () => {
    await setup({ canRun: false }).manager.refresh()
    expect(state('base')).toEqual({ status: 'unavailable' })
    expect(state('tiny')).toEqual({ status: 'unavailable' })
  })

  it('reports what a download would fetch, or that a model is ready', async () => {
    const { caches, manager } = setup()
    seed(caches, 'tiny')
    await manager.refresh()
    expect(state('tiny')).toEqual({ status: 'ready' })
    expect(state('base')).toEqual({ status: 'missing', missingBytes: modelBytes('base') })
  })

  it('downloads with progress, asks for persistent storage and announces the new model', async () => {
    const { deps, manager } = setup()
    const seen: DownloadProgress[] = []
    const unsubscribe = useWhisperStore.subscribe((s) => {
      const base = s.models.base
      if (base.status === 'downloading') seen.push(base.progress)
    })
    const revision = useWhisperStore.getState().revision
    expect(await manager.download('base')).toBe(true)
    unsubscribe()
    expect(deps.client.prepare).toHaveBeenCalledWith('base', expect.objectContaining({ download: true }))
    expect(seen.at(-1)).toEqual({ loaded: 50, total: 100 })
    expect(deps.persist).toHaveBeenCalled()
    expect(state('base')).toEqual({ status: 'ready' })
    expect(useWhisperStore.getState().revision).toBe(revision + 1)
  })

  it('does not start a download that cannot fit on the device', async () => {
    const { deps, manager } = setup({ freeBytes: 10_000_000 })
    expect(await manager.download('base')).toBe(false)
    expect(deps.client.prepare).not.toHaveBeenCalled()
    expect(state('base')).toMatchObject({ status: 'failed', code: 'storage-full' })
  })

  it('fails when the files did not land in the cache (e.g. quota hit while caching)', async () => {
    const { deps, manager } = setup()
    deps.client.prepare.mockImplementationOnce(async () => 'wasm')
    expect(await manager.download('tiny')).toBe(false)
    expect(state('tiny')).toMatchObject({ status: 'failed', code: 'storage-full' })
  })

  it('reports a lost connection and restarts the worker so a retry starts clean', async () => {
    const { deps, manager } = setup()
    deps.client.prepare.mockRejectedValueOnce(new WhisperWorkerError('network', 'Failed to fetch'))
    expect(await manager.download('base')).toBe(false)
    expect(state('base')).toEqual({ status: 'failed', code: 'network', missingBytes: modelBytes('base') + runtime.bytes })
    expect(deps.client.terminate).toHaveBeenCalledTimes(1)
  })

  it('cancels a running download', async () => {
    const { deps, manager } = setup()
    let rejectPending: ((error: WhisperWorkerError) => void) | undefined
    deps.client.prepare.mockImplementationOnce(
      () =>
        new Promise<WhisperDevice>((_, reject) => {
          rejectPending = reject
        }),
    )
    deps.client.terminate.mockImplementationOnce(() => rejectPending?.(new WhisperWorkerError('aborted')))
    const download = manager.download('base')
    await vi.waitFor(() => expect(state('base').status).toBe('downloading'))
    manager.cancel()
    expect(await download).toBe(false)
    expect(deps.client.terminate).toHaveBeenCalled()
    expect(state('base')).toMatchObject({ status: 'missing' })
  })

  it('deletes a model after releasing it in the worker', async () => {
    const { caches, deps, manager } = setup()
    seed(caches, 'base')
    await manager.refresh()
    const revision = useWhisperStore.getState().revision
    await manager.remove('base')
    expect(deps.client.release).toHaveBeenCalled()
    expect(state('base')).toMatchObject({ status: 'missing' })
    expect(caches.cache(MODEL_CACHE).entries.size).toBe(0)
    expect(useWhisperStore.getState().revision).toBe(revision + 1)
  })
})
