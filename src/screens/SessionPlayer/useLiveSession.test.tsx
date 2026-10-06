import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MatchResult } from '@/domain/matcher'
import { MID_SENTENCE_HOLD_MS } from '@/domain/live/pauses'
import type { SpeechEngine, SpeechStartOptions } from '@/domain/speech/SpeechEngine'
import { useLiveSession, type LiveSentence } from './useLiveSession'

const TEN = 'Każdego dnia rano wstaję wcześnie i dziękuję za nowy dzień.'
/** Two of the ten words left out: 80 %. */
const EIGHT = 'każdego dnia rano wcześnie i za nowy dzień'

/** A continuous recogniser the test speaks through. */
function liveEngine() {
  let started: SpeechStartOptions | undefined
  const engine: SpeechEngine = {
    id: 'webspeech',
    isSupported: async () => true,
    start: vi.fn<SpeechEngine['start']>(async (options) => {
      started = options
    }),
    stop: vi.fn<SpeechEngine['stop']>(),
    abort: vi.fn<SpeechEngine['abort']>(),
  }
  return { engine, speech: () => started! }
}

describe('useLiveSession', () => {
  it('checks the sentence on the rung it is given, and again on the next rung after a rejection', async () => {
    const { engine, speech } = liveEngine()
    const verdicts: MatchResult[] = []
    const onVerdict = vi.fn<(entryIndex: number, result: MatchResult) => Promise<void>>(async (_entryIndex, result) => void verdicts.push(result))
    const sentence = (threshold: number): LiveSentence => ({ entryIndex: 0, source: TEN, lang: 'pl', threshold })
    const hook = renderHook((target: LiveSentence) => useLiveSession({ engine, target, onVerdict }), { initialProps: sentence(0.9) })
    await act(() => hook.result.current.start())

    // First try: 80 % is not enough; the pause settles it as a rejection.
    await act(async () => {
      speech().onTranscript?.(EIGHT, false, [])
      speech().onSilence?.()
    })
    expect(verdicts).toMatchObject([{ accepted: false, reason: 'coverage', threshold: 0.9 }])

    // The player moves the same sentence to the next rung; the same words now pass.
    hook.rerender(sentence(0.8))
    await act(async () => speech().onTranscript?.(`${EIGHT} ${EIGHT}`, false, []))
    expect(verdicts).toMatchObject([{ accepted: false }, { accepted: true, missing: 2, threshold: 0.8 }])
  })

  describe('a pause in the middle of a sentence', () => {
    afterEach(() => {
      vi.useRealTimers()
    })
    const setup = async () => {
      vi.useFakeTimers()
      const { engine, speech } = liveEngine()
      const verdicts: MatchResult[] = []
      const onVerdict = vi.fn<(entryIndex: number, result: MatchResult) => Promise<void>>(async (_entryIndex, result) => void verdicts.push(result))
      const target: LiveSentence = { entryIndex: 0, source: TEN, lang: 'pl', threshold: 0.9 }
      const hook = renderHook(() => useLiveSession({ engine, target, onVerdict }))
      await act(() => hook.result.current.start())
      return { speech, verdicts }
    }

    it('is judged only once the quiet lasts', async () => {
      const { speech, verdicts } = await setup()
      await act(async () => {
        speech().onTranscript?.('każdego dnia rano', false, [])
        speech().onSilence?.()
      })
      expect(verdicts).toEqual([])
      await act(() => vi.advanceTimersByTimeAsync(MID_SENTENCE_HOLD_MS - 1))
      expect(verdicts).toEqual([])
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(verdicts).toMatchObject([{ accepted: false, reason: 'coverage' }])
    })

    it('keeps waiting when the recogniser only finalises the words already heard', async () => {
      const { speech, verdicts } = await setup()
      await act(async () => {
        speech().onTranscript?.('każdego dnia rano', false, [])
        speech().onSilence?.()
      })
      await act(() => vi.advanceTimersByTimeAsync(1000))
      await act(async () => speech().onTranscript?.('każdego dnia rano', true, []))
      await act(() => vi.advanceTimersByTimeAsync(MID_SENTENCE_HOLD_MS - 1000))
      expect(verdicts).toMatchObject([{ accepted: false, reason: 'coverage' }])
    })

    it('costs nothing when the speaker goes on', async () => {
      const { speech, verdicts } = await setup()
      await act(async () => {
        speech().onTranscript?.('każdego dnia rano', false, [])
        speech().onSilence?.()
      })
      await act(async () => speech().onTranscript?.('każdego dnia rano wstaję wcześnie', false, []))
      await act(() => vi.advanceTimersByTimeAsync(MID_SENTENCE_HOLD_MS * 2))
      expect(verdicts).toEqual([])
      await act(async () => speech().onTranscript?.('każdego dnia rano wstaję wcześnie i dziękuję za nowy dzień', false, []))
      expect(verdicts).toMatchObject([{ accepted: true }])
    })
  })
})
