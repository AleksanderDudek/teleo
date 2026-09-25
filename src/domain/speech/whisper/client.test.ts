import { describe, expect, it, vi } from 'vitest'
import { WhisperClient, WhisperWorkerError, type WorkerFactory } from './client'
import type { WorkerRequest, WorkerResponse } from './protocol'

/** A scriptable stand-in for the Whisper worker. */
function fakeWorker() {
  const host = {
    created: 0,
    terminated: 0,
    requests: [] as WorkerRequest[],
    transfers: [] as Transferable[][],
    onMessage: (_data: unknown) => {},
    onFailure: (_message: string) => {},
    reply(response: WorkerResponse) {
      host.onMessage(response)
    },
    last(): WorkerRequest {
      return host.requests.at(-1)!
    },
  }
  const factory: WorkerFactory = (onMessage, onFailure) => {
    host.created++
    host.onMessage = onMessage
    host.onFailure = onFailure
    return {
      post(message, transfer = []) {
        host.requests.push(message)
        host.transfers.push(transfer)
      },
      terminate() {
        host.terminated++
      },
    }
  }
  return { host, client: new WhisperClient(factory) }
}

describe('WhisperClient', () => {
  it('starts the worker only when first needed', async () => {
    const { host, client } = fakeWorker()
    expect(host.created).toBe(0)
    await client.release()
    expect(host.created).toBe(0)
    void client.prepare('base', { download: false })
    expect(host.created).toBe(1)
  })

  it('prepares a model and relays download progress', async () => {
    const { host, client } = fakeWorker()
    const onProgress = vi.fn<(progress: { loaded: number; total: number }) => void>()
    const prepared = client.prepare('tiny', { download: true, onProgress })
    const request = host.last()
    expect(request).toEqual({ type: 'prepare', id: request.id, model: 'tiny', download: true })
    host.reply({ type: 'progress', id: request.id, loaded: 5, total: 10 })
    host.reply({ type: 'prepared', id: request.id, device: 'wasm' })
    await expect(prepared).resolves.toBe('wasm')
    expect(onProgress).toHaveBeenCalledWith({ loaded: 5, total: 10 })
  })

  it('transfers the audio for transcription', async () => {
    const { host, client } = fakeWorker()
    const audio = new Float32Array(16)
    const text = client.transcribe('base', 'pl-PL', audio)
    expect(host.last()).toMatchObject({ type: 'transcribe', model: 'base', lang: 'pl-PL', audio })
    expect(host.transfers.at(-1)).toEqual([audio.buffer])
    host.reply({ type: 'transcript', id: host.last().id, text: 'Dzień dobry.' })
    await expect(text).resolves.toBe('Dzień dobry.')
  })

  it('routes concurrent answers by id', async () => {
    const { host, client } = fakeWorker()
    const first = client.transcribe('base', 'en-US', new Float32Array(1))
    const second = client.transcribe('base', 'en-US', new Float32Array(1))
    const [a, b] = host.requests
    host.reply({ type: 'transcript', id: b!.id, text: 'second' })
    host.reply({ type: 'transcript', id: a!.id, text: 'first' })
    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('second')
  })

  it('rejects with the worker’s error code', async () => {
    const { host, client } = fakeWorker()
    const prepared = client.prepare('base', { download: false })
    host.reply({ type: 'error', id: host.last().id, code: 'model-missing', message: 'not cached' })
    await expect(prepared).rejects.toEqual(new WhisperWorkerError('model-missing', 'not cached'))
  })

  it('ignores malformed messages', async () => {
    const { host, client } = fakeWorker()
    const prepared = client.prepare('base', { download: false })
    host.onMessage({ type: 'prepared', id: host.last().id, device: 'quantum' })
    host.onMessage('garbage')
    host.reply({ type: 'prepared', id: host.last().id, device: 'webgpu' })
    await expect(prepared).resolves.toBe('webgpu')
  })

  it('fails every pending request when the worker crashes, then starts a new worker', async () => {
    const { host, client } = fakeWorker()
    const prepared = client.prepare('base', { download: false })
    host.onFailure('worker script failed to load')
    await expect(prepared).rejects.toMatchObject({ code: 'unknown' })
    void client.prepare('base', { download: false })
    expect(host.created).toBe(2)
  })

  it('aborts everything on terminate (e.g. a cancelled download)', async () => {
    const { host, client } = fakeWorker()
    const prepared = client.prepare('base', { download: true })
    client.terminate()
    await expect(prepared).rejects.toMatchObject({ code: 'aborted' })
    expect(host.terminated).toBe(1)
    void client.prepare('base', { download: false })
    expect(host.created).toBe(2)
  })

  it('asks a running worker to release its models', async () => {
    const { host, client } = fakeWorker()
    void client.prepare('base', { download: false })
    const released = client.release()
    expect(host.last()).toMatchObject({ type: 'release' })
    host.reply({ type: 'released', id: host.last().id })
    await expect(released).resolves.toBeUndefined()
  })
})
