import { describe, expect, it } from 'vitest'
import { isSafariBelow26, isStaleRuntimeUrl, ORT_RUNTIME_FILES, ortRuntime } from './runtime'

const VERSION = '1.31.0-dev.20260914-8d85527a0'
const SAFARI_18 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
const SAFARI_26 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
const IOS_17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0'

describe('ortRuntime', () => {
  it('uses the asyncify build (WebGPU + WebAssembly) with its embedded loader', () => {
    const runtime = ortRuntime({ base: '/teleo/', version: VERSION, legacySafari: false })
    expect(runtime.wasm).toBe(`/teleo/ort/${VERSION}/ort-wasm-simd-threaded.asyncify.wasm`)
    expect(runtime.mjs).toBeUndefined()
    expect(runtime.urls).toEqual([runtime.wasm])
    expect(runtime.bytes).toBeGreaterThan(26e6)
  })

  it('uses the plain WebAssembly build on Safari before 26, as transformers.js does', () => {
    const runtime = ortRuntime({ base: '/teleo/', version: VERSION, legacySafari: true })
    expect(runtime.wasm).toBe(`/teleo/ort/${VERSION}/ort-wasm-simd-threaded.wasm`)
    expect(runtime.mjs).toBe(`/teleo/ort/${VERSION}/ort-wasm-simd-threaded.mjs`)
    expect(runtime.urls).toEqual([runtime.mjs, runtime.wasm])
    expect(runtime.bytes).toBeLessThan(15e6)
  })

  it('ships every file either variant needs', () => {
    for (const legacySafari of [false, true]) {
      for (const url of ortRuntime({ base: '/', version: VERSION, legacySafari }).urls) {
        expect(ORT_RUNTIME_FILES).toContain(url.split('/').at(-1))
      }
    }
  })
})

describe('isSafariBelow26', () => {
  it('detects older Safari on macOS and iOS', () => {
    expect(isSafariBelow26(SAFARI_18)).toBe(true)
    expect(isSafariBelow26(IOS_17)).toBe(true)
  })

  it('ignores Safari 26+ and other browsers', () => {
    for (const userAgent of [SAFARI_26, IOS_CHROME, CHROME, FIREFOX, '']) expect(isSafariBelow26(userAgent)).toBe(false)
  })
})

describe('isStaleRuntimeUrl', () => {
  const runtime = ortRuntime({ base: '/teleo/', version: VERSION, legacySafari: false })

  it('keeps the current runtime', () => {
    expect(isStaleRuntimeUrl(`https://example.github.io/teleo/ort/${VERSION}/ort-wasm-simd-threaded.asyncify.wasm`, runtime)).toBe(false)
  })

  it('flags files of older versions or the other variant', () => {
    expect(isStaleRuntimeUrl('https://example.github.io/teleo/ort/1.30.0/ort-wasm-simd-threaded.asyncify.wasm', runtime)).toBe(true)
    expect(isStaleRuntimeUrl(`https://example.github.io/teleo/ort/${VERSION}/ort-wasm-simd-threaded.wasm`, runtime)).toBe(true)
  })
})
