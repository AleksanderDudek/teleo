import { modelFileUrls, WHISPER_MODEL_IDS, WHISPER_MODELS, type WhisperModelId } from './models'
import { isStaleRuntimeUrl, ORT_CACHE, type OrtRuntime } from './runtime'

/**
 * Offline storage of the Whisper engine, all in Cache Storage:
 * - model files in transformers.js' own cache ({@link MODEL_CACHE}, keyed by
 *   their Hugging Face URL), written only by an explicit download;
 * - the onnxruntime-web runtime in {@link ORT_CACHE} (keyed by its URL on this
 *   site), shared by both models.
 * Works on the real `CacheStorage` in a page or a worker.
 */
export const MODEL_CACHE = 'transformers-cache'

export interface CacheLike {
  match(request: string): Promise<Response | undefined>
  put(request: string, response: Response): Promise<void>
  delete(request: string): Promise<boolean>
  keys(): Promise<ReadonlyArray<{ url: string }>>
}

export interface CacheStorageLike {
  has(name: string): Promise<boolean>
  open(name: string): Promise<CacheLike>
  delete(name: string): Promise<boolean>
}

export interface StorageDeps {
  caches: CacheStorageLike
  runtime: OrtRuntime
}

export interface ModelStatus {
  /** Model files and runtime are all cached: recognition works offline. */
  ready: boolean
  /** Bytes a download would still fetch. */
  missingBytes: number
}

async function openIfExists(caches: CacheStorageLike, name: string): Promise<CacheLike | undefined> {
  return (await caches.has(name)) ? caches.open(name) : undefined
}

async function missingModelBytes(model: WhisperModelId, caches: CacheStorageLike): Promise<number> {
  const cache = await openIfExists(caches, MODEL_CACHE)
  const urls = modelFileUrls(model)
  let missing = 0
  for (const [index, file] of WHISPER_MODELS[model].files.entries()) {
    if (!cache || !(await cache.match(urls[index]!))) missing += file.bytes
  }
  return missing
}

async function runtimeCached(caches: CacheStorageLike, runtime: OrtRuntime): Promise<boolean> {
  const cache = await openIfExists(caches, ORT_CACHE)
  if (!cache) return false
  for (const url of runtime.urls) if (!(await cache.match(url))) return false
  return true
}

/** Whether a model can run offline, and how much a download would still fetch. Never creates a cache. */
export async function inspectModel(model: WhisperModelId, { caches, runtime }: StorageDeps): Promise<ModelStatus> {
  const missingBytes = (await missingModelBytes(model, caches)) + ((await runtimeCached(caches, runtime)) ? 0 : runtime.bytes)
  return { ready: missingBytes === 0, missingBytes }
}

/** Deletes a model's files; the shared runtime goes too when no other model is left. */
export async function deleteModel(model: WhisperModelId, { caches }: StorageDeps): Promise<void> {
  const cache = await openIfExists(caches, MODEL_CACHE)
  if (cache) for (const url of modelFileUrls(model)) await cache.delete(url)
  for (const other of WHISPER_MODEL_IDS) {
    if (other !== model && (await missingModelBytes(other, caches)) === 0) return
  }
  await caches.delete(ORT_CACHE)
}

/** Drops runtime files that the current build no longer uses (older onnxruntime versions). */
export async function pruneRuntime({ caches, runtime }: StorageDeps): Promise<void> {
  const cache = await openIfExists(caches, ORT_CACHE)
  if (!cache) return
  for (const request of await cache.keys()) {
    if (isStaleRuntimeUrl(request.url, runtime)) await cache.delete(request.url)
  }
}

export interface RuntimeFileDeps {
  caches: CacheStorageLike
  fetch: (url: string) => Promise<Response>
  /** Only an explicit download may fetch; otherwise a missing file means "not downloaded". */
  allowNetwork: boolean
  expectedBytes: number
  onProgress?: (loaded: number, total: number) => void
}

const notDownloaded = (url: string) =>
  Object.assign(new Error(`The offline speech runtime is not downloaded: ${url}`), { name: 'ModelFileNotFoundError' })

/**
 * A runtime file from {@link ORT_CACHE}, downloading (with progress) and caching
 * it when allowed. Reading it ourselves — instead of letting onnxruntime fetch
 * it — makes offline use independent of the service worker.
 */
export async function loadRuntimeFile(url: string, deps: RuntimeFileDeps): Promise<ArrayBuffer> {
  const existing = await openIfExists(deps.caches, ORT_CACHE)
  const cached = await existing?.match(url)
  if (cached) {
    const bytes = await cached.arrayBuffer()
    deps.onProgress?.(bytes.byteLength, bytes.byteLength)
    return bytes
  }
  if (!deps.allowNetwork) throw notDownloaded(url)
  const response = await deps.fetch(url)
  if (!response.ok) throw new Error(`Speech runtime download failed (HTTP ${response.status}): ${url}`)
  const bytes = await readBody(response, deps.expectedBytes, deps.onProgress)
  const headers = new Headers(response.headers)
  headers.set('content-length', String(bytes.byteLength))
  const cache = existing ?? (await deps.caches.open(ORT_CACHE))
  await cache.put(url, new Response(bytes, { headers }))
  return bytes.buffer
}

async function readBody(response: Response, expectedBytes: number, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body || !onProgress) return new Uint8Array(await response.arrayBuffer())
  // content-length is the compressed size when the server gzips; the stream yields decompressed bytes.
  const total = Number(response.headers.get('content-length')) || expectedBytes
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, Math.max(total, loaded))
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress(loaded, loaded)
  return bytes
}
