/**
 * The onnxruntime-web WebAssembly runtime that transformers.js runs Whisper on.
 * It is self-hosted (copied from `node_modules/onnxruntime-web/dist` into
 * `dist/ort/<version>/` by the build — see `vite.config.ts`): the production
 * CSP allows scripts from 'self' only, and no CDN may learn who uses Teleo.
 * The version in the path keeps cache-first caching safe across upgrades.
 *
 * Kept free of imports: `vite.config.ts` reads the file list from here.
 */

/** Cache Storage bucket for the runtime (also used by the service worker's cache-first route). */
export const ORT_CACHE = 'teleo-ort'

const ASYNCIFY_WASM = { name: 'ort-wasm-simd-threaded.asyncify.wasm', bytes: 26_861_777 }
const PLAIN_MJS = { name: 'ort-wasm-simd-threaded.mjs', bytes: 24_381 }
const PLAIN_WASM = { name: 'ort-wasm-simd-threaded.wasm', bytes: 14_264_838 }

/** Files the build publishes under `ort/<version>/`. */
export const ORT_RUNTIME_FILES: readonly string[] = [ASYNCIFY_WASM.name, PLAIN_MJS.name, PLAIN_WASM.name]

/** Download size shown to the user (the common variant). */
export const ORT_RUNTIME_BYTES = ASYNCIFY_WASM.bytes

export interface OrtRuntime {
  /** WebAssembly binary (`env.wasm.wasmPaths.wasm`). */
  wasm: string
  /** External loader (`env.wasm.wasmPaths.mjs`); absent when the loader bundled with onnxruntime-web is used. */
  mjs?: string
  /** Every URL of this runtime, to keep in {@link ORT_CACHE}. */
  urls: string[]
  bytes: number
}

/**
 * Runtime files for this browser. Normally the asyncify build (WebGPU and
 * WebAssembly), whose loader ships inside the onnxruntime-web bundle. Safari
 * before 26 gets the plain WebAssembly build — the same switch transformers.js
 * makes for its CDN default.
 */
export function ortRuntime(options: { base: string; version: string; legacySafari: boolean }): OrtRuntime {
  const dir = `${options.base}ort/${options.version}/`
  if (options.legacySafari) {
    const mjs = dir + PLAIN_MJS.name
    const wasm = dir + PLAIN_WASM.name
    return { wasm, mjs, urls: [mjs, wasm], bytes: PLAIN_MJS.bytes + PLAIN_WASM.bytes }
  }
  const wasm = dir + ASYNCIFY_WASM.name
  return { wasm, urls: [wasm], bytes: ASYNCIFY_WASM.bytes }
}

/** Safari (macOS/iOS) older than 26; uses only the user agent, which workers can read too. */
export function isSafariBelow26(userAgent: string): boolean {
  if (!/Safari\//.test(userAgent) || /Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Android|mercury|brave/i.test(userAgent)) return false
  const version = userAgent.match(/Version\/(\d+)/)?.[1]
  return version !== undefined && Number(version) < 26
}

/** A cached runtime file that the current app no longer uses (older version or other variant). */
export function isStaleRuntimeUrl(url: string, runtime: OrtRuntime): boolean {
  const path = (value: string) => new URL(value, 'https://teleo.invalid').pathname
  const current = new Set(runtime.urls.map(path))
  return !current.has(path(url))
}
