import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SpeechError, type SpeechEngine, type SpeechResult } from '@/domain/speech/SpeechEngine'
import { useTapCapture } from './useTapCapture'

/** An engine whose recognition finishes only when the test says so (like Whisper, which transcribes after stop). */
function slowEngine() {
  let settle: { resolve: (result: SpeechResult) => void; reject: (error: unknown) => void } | undefined
  const engine: SpeechEngine = {
    id: 'whisper',
    isSupported: async () => true,
    start: vi.fn<SpeechEngine['start']>(async () => {}),
    stop: vi.fn<SpeechEngine['stop']>(() => new Promise<SpeechResult>((resolve, reject) => (settle = { resolve, reject }))),
    abort: vi.fn<SpeechEngine['abort']>(),
  }
  return { engine, settle: () => settle! }
}

const heard: SpeechResult = { alternatives: ['Dzień dobry'], durationMs: 900, engine: 'whisper' }

async function listening(engine: SpeechEngine, onResult: (result: SpeechResult) => void) {
  const hook = renderHook(() => useTapCapture({ engine, lang: 'pl-PL', onResult }))
  await act(() => hook.result.current.start())
  act(() => void hook.result.current.stop())
  expect(hook.result.current.phase).toBe('stopping')
  return hook
}

describe('useTapCapture', () => {
  it('delivers the result once recognition finishes', async () => {
    const { engine, settle } = slowEngine()
    const onResult = vi.fn<(result: SpeechResult) => void>()
    const { result } = await listening(engine, onResult)
    await act(async () => settle().resolve(heard))
    expect(onResult).toHaveBeenCalledWith(heard)
    expect(result.current.phase).toBe('idle')
  })

  it('shows a recognition failure instead of a result', async () => {
    const { engine, settle } = slowEngine()
    const onResult = vi.fn<(result: SpeechResult) => void>()
    const { result } = await listening(engine, onResult)
    await act(async () => settle().reject(new SpeechError('model-missing')))
    expect(onResult).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
    expect(result.current.error).toBe('model-missing')
  })

  it('ignores a result that arrives after the capture was cancelled (e.g. the sentence was skipped)', async () => {
    const { engine, settle } = slowEngine()
    const onResult = vi.fn<(result: SpeechResult) => void>()
    const { result } = await listening(engine, onResult)
    act(() => result.current.cancel())
    await act(async () => settle().resolve(heard))
    expect(onResult).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
  })
})
