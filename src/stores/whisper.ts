import { create } from 'zustand'
import { whisperEngine } from '@/domain/speech/registry'
import { deleteModel, inspectModel, type StorageDeps } from '@/domain/speech/whisper/cache'
import { WhisperWorkerError, type WhisperClient } from '@/domain/speech/whisper/client'
import { WHISPER_MODEL_IDS, type WhisperModelId } from '@/domain/speech/whisper/models'
import type { DownloadProgress } from '@/domain/speech/whisper/progress'
import { whisperClient, whisperStorage } from '@/domain/speech/whisperSetup'

export type DownloadFailure = 'network' | 'storage-full' | 'unknown'

export type ModelState =
  | { status: 'checking' }
  /** This browser cannot run Whisper at all. */
  | { status: 'unavailable' }
  | { status: 'missing'; missingBytes: number }
  | { status: 'downloading'; progress: DownloadProgress }
  | { status: 'ready' }
  | { status: 'failed'; code: DownloadFailure; missingBytes: number }

interface WhisperState {
  models: Record<WhisperModelId, ModelState>
  /** Bumped whenever a model appears or disappears, so speech engines get resolved again. */
  revision: number
}

/** Offline Whisper models as the UI sees them (Settings, engine resolution). */
export const useWhisperStore = create<WhisperState>(() => ({
  models: { tiny: { status: 'checking' }, base: { status: 'checking' } },
  revision: 0,
}))

export interface WhisperManagerDeps {
  /** The browser can run Whisper (worker, WebAssembly, Cache Storage, microphone recording). */
  canRun: () => boolean
  storage: () => StorageDeps | undefined
  client: Pick<WhisperClient, 'prepare' | 'release' | 'terminate'>
  estimate?: () => Promise<{ quota?: number; usage?: number } | undefined>
  persist?: () => Promise<boolean>
}

const setModel = (model: WhisperModelId, state: ModelState) =>
  useWhisperStore.setState((s) => ({ models: { ...s.models, [model]: state } }))
const announceChange = () => useWhisperStore.setState((s) => ({ revision: s.revision + 1 }))

/** Explicit downloads (the only way a model reaches the device), cancellation and deletion. */
export function createWhisperManager(deps: WhisperManagerDeps) {
  let downloading: WhisperModelId | null = null

  async function inspect(model: WhisperModelId): Promise<ModelState> {
    const storage = deps.storage()
    if (!storage || !deps.canRun()) return { status: 'unavailable' }
    const { ready, missingBytes } = await inspectModel(model, storage)
    return ready ? { status: 'ready' } : { status: 'missing', missingBytes }
  }

  const missingOf = (state: ModelState, fallback: number) => (state.status === 'missing' ? state.missingBytes : fallback)

  async function refresh(models: readonly WhisperModelId[] = WHISPER_MODEL_IDS): Promise<void> {
    for (const model of models) {
      if (downloading === model) continue
      try {
        setModel(model, await inspect(model))
      } catch {
        setModel(model, { status: 'unavailable' })
      }
    }
  }

  /** Downloads a model (and the speech runtime); resolves whether it is now ready offline. */
  async function download(model: WhisperModelId): Promise<boolean> {
    if (downloading) return false
    const before = await inspect(model)
    setModel(model, before)
    if (before.status !== 'missing') return before.status === 'ready'
    const estimate = await deps.estimate?.().catch(() => undefined)
    if (estimate?.quota !== undefined && estimate.quota - (estimate.usage ?? 0) < before.missingBytes) {
      setModel(model, { status: 'failed', code: 'storage-full', missingBytes: before.missingBytes })
      return false
    }
    downloading = model
    setModel(model, { status: 'downloading', progress: { loaded: 0, total: before.missingBytes } })
    // ~100 MB is worth protecting from eviction when the device runs low on space.
    void deps.persist?.().catch(() => false)
    try {
      await deps.client.prepare(model, { download: true, onProgress: (progress) => setModel(model, { status: 'downloading', progress }) })
    } catch (error) {
      downloading = null
      const code = error instanceof WhisperWorkerError ? error.code : 'unknown'
      if (code === 'aborted') {
        await refresh([model])
        return false
      }
      // A fresh worker for the retry: nothing half-loaded or memoised from the failed attempt survives.
      deps.client.terminate()
      const after = await inspect(model).catch(() => before)
      setModel(model, { status: 'failed', code: code === 'network' || code === 'storage-full' ? code : 'unknown', missingBytes: missingOf(after, before.missingBytes) })
      return false
    }
    downloading = null
    const after = await inspect(model)
    if (after.status !== 'ready') {
      // transformers.js only warns when a file cannot be cached (e.g. quota): it would not work offline.
      setModel(model, { status: 'failed', code: 'storage-full', missingBytes: missingOf(after, before.missingBytes) })
      return false
    }
    setModel(model, after)
    announceChange()
    return true
  }

  /** Stops a running download (the worker is restarted on next use). */
  function cancel(): void {
    if (downloading) deps.client.terminate()
  }

  async function remove(model: WhisperModelId): Promise<void> {
    await deps.client.release().catch(() => {})
    const storage = deps.storage()
    if (storage) await deleteModel(model, storage)
    await refresh()
    announceChange()
  }

  return { refresh, download, cancel, remove }
}

export type WhisperManager = ReturnType<typeof createWhisperManager>

let manager: WhisperManager | undefined

export function whisperModels(): WhisperManager {
  manager ??= createWhisperManager({
    canRun: () => whisperEngine().canRun(),
    storage: whisperStorage,
    client: whisperClient(),
    estimate: async () => globalThis.navigator?.storage?.estimate?.(),
    persist: async () => {
      if (await globalThis.navigator?.storage?.persisted?.()) return true
      return (await globalThis.navigator?.storage?.persist?.()) ?? false
    },
  })
  return manager
}
