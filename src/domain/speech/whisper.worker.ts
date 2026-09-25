/**
 * Whisper recognition off the main thread (spec §5.3): transformers.js on
 * onnxruntime-web — WebGPU when the device offers it, WebAssembly otherwise.
 *
 * Network policy: transformers.js may reach Hugging Face only while an
 * explicit download (`prepare` with `download: true`) runs. At any other time
 * its fetches are answered locally with 404, so loading a cached model can
 * never touch the network, and a missing file surfaces as `model-missing`.
 * The onnxruntime binary is self-hosted and handed over from our own cache.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { loadRuntimeFile, MODEL_CACHE, pruneRuntime } from './whisper/cache'
import { WHISPER_DTYPE, WHISPER_MODELS, type WhisperModelId } from './whisper/models'
import { createProgressAggregator, progressPercent, type DownloadProgress } from './whisper/progress'
import { classifyError, isWorkerRequest, type WhisperDevice, type WorkerRequest, type WorkerResponse } from './whisper/protocol'
import { isSafariBelow26, ortRuntime } from './whisper/runtime'
import { generateOptions } from './whisper/transcribe'

const runtime = ortRuntime({ base: import.meta.env.BASE_URL, version: __ORT_VERSION__, legacySafari: isSafariBelow26(navigator.userAgent) })
const storage = { caches, runtime }

let networkAllowed = false
const notDownloaded = () => new Response(null, { status: 404, statusText: 'Not downloaded' })
env.fetch = (input: string | URL, init?: RequestInit) => (networkAllowed ? fetch(input, init) : Promise.resolve(notDownloaded()))
env.allowLocalModels = false
env.allowRemoteModels = true
env.useBrowserCache = true
env.cacheKey = MODEL_CACHE
// The runtime is cached by us (ORT_CACHE); transformers.js' own copy would load it from a blob: URL.
env.useWasmCache = false

const wasm = env.backends.onnx.wasm
if (wasm) {
  wasm.wasmPaths = runtime.mjs ? { mjs: runtime.mjs, wasm: runtime.wasm } : { wasm: runtime.wasm }
  // GitHub Pages cannot send the headers for cross-origin isolation, so threads are unavailable anyway.
  wasm.numThreads = 1
  wasm.proxy = false
}

interface Loaded {
  transcriber: AutomaticSpeechRecognitionPipeline
  device: WhisperDevice
}

const loaded = new Map<WhisperModelId, Loaded>()
let preferredDevice: WhisperDevice | undefined
let runtimeHandedOver = false

async function pickDevice(): Promise<WhisperDevice> {
  if (runtime.mjs || !('gpu' in navigator) || !navigator.gpu) return 'wasm' // the plain build has no WebGPU
  try {
    return (await navigator.gpu.requestAdapter()) ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

/** Makes sure the runtime files are cached (downloading them only when allowed) and gives the binary to onnxruntime once. */
async function ensureRuntime(allowNetwork: boolean, onProgress?: (loaded: number, total: number) => void) {
  const load = (url: string, expectedBytes: number, progress?: (loaded: number, total: number) => void) =>
    loadRuntimeFile(url, { caches, fetch: (target) => fetch(target), allowNetwork, expectedBytes, onProgress: progress })
  if (runtime.mjs) await load(runtime.mjs, 0)
  const binary = await load(runtime.wasm, runtime.bytes, onProgress)
  if (!runtimeHandedOver && wasm) wasm.wasmBinary = binary
}

async function createTranscriber(model: WhisperModelId, device: WhisperDevice, onFile?: (file: string, loaded: number, total?: number) => void) {
  const transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODELS[model].repo, {
    dtype: WHISPER_DTYPE,
    device,
    progress_callback: onFile
      ? (info) => {
          if (info.status === 'progress') onFile(info.file, info.loaded, info.total)
          else if (info.status === 'done') onFile(info.file, Infinity)
        }
      : undefined,
  })
  runtimeHandedOver = true
  return transcriber
}

async function load(model: WhisperModelId, onFile?: (file: string, loaded: number, total?: number) => void): Promise<Loaded> {
  const device = (preferredDevice ??= await pickDevice())
  try {
    return { transcriber: await createTranscriber(model, device, onFile), device }
  } catch (error) {
    // WebGPU can fail on a given GPU/driver; WebAssembly always works.
    if (device !== 'webgpu' || classifyError(error) !== 'unknown') throw error
    preferredDevice = 'wasm'
    return { transcriber: await createTranscriber(model, 'wasm', onFile), device: 'wasm' }
  }
}

async function unload(model: WhisperModelId) {
  const entry = loaded.get(model)
  loaded.delete(model)
  await entry?.transcriber.dispose()
}

async function releaseAll() {
  for (const model of [...loaded.keys()]) await unload(model)
}

async function prepare(model: WhisperModelId, download: boolean, report: (progress: DownloadProgress) => void): Promise<WhisperDevice> {
  const ready = loaded.get(model)
  if (ready && !download) return ready.device
  // Only one model in memory at a time (whisper-base needs ~300 MB while running).
  await releaseAll()
  if (!download) {
    // onnxruntime initialises WebAssembly once per worker; later loads do not need the binary.
    if (!runtimeHandedOver) await ensureRuntime(false)
    const entry = await load(model)
    loaded.set(model, entry)
    return entry.device
  }
  const progress = createProgressAggregator({
    runtime: runtime.bytes,
    ...Object.fromEntries(WHISPER_MODELS[model].files.map((file) => [file.path, file.bytes])),
  })
  networkAllowed = true
  try {
    await ensureRuntime(true, (bytes, total) => report(progress.update('runtime', bytes, total)))
    report(progress.finish('runtime'))
    const entry = await load(model, (file, bytes, total) => report(bytes === Infinity ? progress.finish(file) : progress.update(file, bytes, total)))
    loaded.set(model, entry)
    await pruneRuntime(storage)
    return entry.device
  } finally {
    networkAllowed = false
  }
}

async function transcribe(model: WhisperModelId, request: Extract<WorkerRequest, { type: 'transcribe' }>): Promise<string> {
  const options = generateOptions(request.lang, request.audio.length)
  await prepare(model, false, () => {})
  const entry = loaded.get(model)!
  try {
    const output = await entry.transcriber(request.audio, options)
    return (Array.isArray(output) ? output[0]?.text : output.text) ?? ''
  } catch (error) {
    if (entry.device !== 'webgpu') throw error
    // A WebGPU failure at inference: continue on WebAssembly for the rest of this session.
    preferredDevice = 'wasm'
    await unload(model)
    await prepare(model, false, () => {})
    const output = await loaded.get(model)!.transcriber(request.audio, options)
    return (Array.isArray(output) ? output[0]?.text : output.text) ?? ''
  }
}

const post = (response: WorkerResponse) => self.postMessage(response)

async function handle(request: WorkerRequest) {
  try {
    if (request.type === 'prepare') {
      let lastPercent = -1
      const device = await prepare(request.model, request.download, (progress) => {
        const percent = progressPercent(progress)
        if (percent === lastPercent) return
        lastPercent = percent
        post({ type: 'progress', id: request.id, ...progress })
      })
      post({ type: 'prepared', id: request.id, device })
    } else if (request.type === 'transcribe') {
      post({ type: 'transcript', id: request.id, text: await transcribe(request.model, request) })
    } else {
      await releaseAll()
      post({ type: 'released', id: request.id })
    }
  } catch (error) {
    post({ type: 'error', id: request.id, code: classifyError(error), message: error instanceof Error ? error.message : String(error) })
  }
}

// One request at a time: loads and inference must not interleave.
let queue = Promise.resolve()
self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = event.data
  if (!isWorkerRequest(request)) return
  queue = queue.then(() => handle(request))
})
