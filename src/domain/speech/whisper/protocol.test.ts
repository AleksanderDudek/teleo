import { describe, expect, it } from 'vitest'
import { classifyError, isWorkerRequest, isWorkerResponse } from './protocol'

describe('isWorkerRequest', () => {
  it('accepts the three requests', () => {
    expect(isWorkerRequest({ type: 'prepare', id: 1, model: 'base', download: true })).toBe(true)
    expect(isWorkerRequest({ type: 'transcribe', id: 2, model: 'tiny', lang: 'pl-PL', audio: new Float32Array(4) })).toBe(true)
    expect(isWorkerRequest({ type: 'release', id: 3 })).toBe(true)
  })

  it('rejects malformed messages', () => {
    for (const message of [
      null,
      'prepare',
      { type: 'prepare', model: 'base', download: true },
      { type: 'prepare', id: 1.5, model: 'base', download: true },
      { type: 'prepare', id: -1, model: 'base', download: true },
      { type: 'prepare', id: 1, model: 'large', download: true },
      { type: 'prepare', id: 1, model: 'base', download: 'yes' },
      { type: 'transcribe', id: 2, model: 'tiny', lang: 'de-DE', audio: new Float32Array(4) },
      { type: 'transcribe', id: 2, model: 'tiny', lang: 'pl-PL', audio: [0, 0] },
      { type: 'explode', id: 4 },
    ]) {
      expect(isWorkerRequest(message)).toBe(false)
    }
  })
})

describe('isWorkerResponse', () => {
  it('accepts every response', () => {
    for (const message of [
      { type: 'progress', id: 1, loaded: 10, total: 100 },
      { type: 'prepared', id: 1, device: 'wasm' },
      { type: 'prepared', id: 1, device: 'webgpu' },
      { type: 'transcript', id: 2, text: 'Dzień dobry.' },
      { type: 'released', id: 3 },
      { type: 'error', id: 1, code: 'model-missing', message: 'not cached' },
    ]) {
      expect(isWorkerResponse(message)).toBe(true)
    }
  })

  it('rejects malformed responses', () => {
    for (const message of [
      undefined,
      { type: 'progress', id: 1, loaded: Number.NaN, total: 100 },
      { type: 'prepared', id: 1, device: 'cuda' },
      { type: 'transcript', id: 2 },
      { type: 'error', id: 1, code: 'meltdown', message: '' },
      { type: 'error', id: 1, code: 'unknown' },
    ]) {
      expect(isWorkerResponse(message)).toBe(false)
    }
  })
})

describe('classifyError', () => {
  it('recognises a model that is not in the cache', () => {
    expect(classifyError(Object.assign(new Error('missing'), { name: 'ModelFileNotFoundError' }))).toBe('model-missing')
  })

  it('recognises a full disk', () => {
    expect(classifyError(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }))).toBe('storage-full')
  })

  it('recognises network failures of every browser', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('network')
    expect(classifyError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('network')
    expect(classifyError(new TypeError('Load failed'))).toBe('network')
  })

  it('falls back to unknown', () => {
    expect(classifyError(new Error('boom'))).toBe('unknown')
    expect(classifyError('boom')).toBe('unknown')
  })
})
