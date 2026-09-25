import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRecognition } from '@/test/fakeRecognition'
import { SpeechError } from './SpeechEngine'
import { WebSpeechEngine } from './WebSpeechEngine'

const CHROME_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const SAFARI_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15'

const engine = (userAgent = CHROME_UA) =>
  new WebSpeechEngine({ scope: { SpeechRecognition: FakeRecognition }, userAgent })
const last = () => FakeRecognition.instances.at(-1)!

beforeEach(() => {
  FakeRecognition.reset()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('WebSpeechEngine', () => {
  it('reports lack of support', async () => {
    const unsupported = new WebSpeechEngine({ scope: {} })
    expect(await unsupported.isSupported()).toBe(false)
    await expect(unsupported.start({ lang: 'pl-PL' })).rejects.toMatchObject({ code: 'not-supported' })
  })

  it('configures continuous recognition with interim results and 3 alternatives', async () => {
    await engine().start({ lang: 'pl-PL' })
    expect(last()).toMatchObject({ lang: 'pl-PL', continuous: true, interimResults: true, maxAlternatives: 3, processLocally: false })
  })

  it('prefers on-device recognition when the language pack is available', async () => {
    FakeRecognition.availability = 'available'
    await engine().start({ lang: 'en-US' })
    expect(last().processLocally).toBe(true)
  })

  it('streams the transcript and returns alternatives on stop', async () => {
    const transcripts: string[] = []
    const e = engine()
    await e.start({ lang: 'pl-PL', onTranscript: (text) => transcripts.push(text) })
    last().emit([true, 'Jestem spokojny'], [false, ' i pewny siebie', ' i pewny sobie'])
    expect(transcripts).toEqual(['Jestem spokojny i pewny siebie'])
    const result = await e.stop()
    expect(result.alternatives).toEqual(['Jestem spokojny i pewny siebie', 'Jestem spokojny i pewny sobie'])
    expect(result.engine).toBe('webspeech')
  })

  it('signals silence 1.5 s after the last result', async () => {
    const onSilence = vi.fn()
    await engine().start({ lang: 'pl-PL', onSilence })
    last().emit([false, 'Jestem'])
    await vi.advanceTimersByTimeAsync(1400)
    last().emit([false, 'Jestem spokojny'])
    await vi.advanceTimersByTimeAsync(1400)
    expect(onSilence).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(onSilence).toHaveBeenCalledTimes(1)
  })

  it('gives up after 8 s of no speech in tap mode, but not in live mode', async () => {
    const tap = vi.fn()
    const e = engine()
    await e.start({ lang: 'pl-PL', onSilence: tap })
    await vi.advanceTimersByTimeAsync(8000)
    expect(tap).toHaveBeenCalledTimes(1)
    e.abort()
    const live = vi.fn()
    await engine().start({ lang: 'pl-PL', continuous: true, onSilence: live })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(live).not.toHaveBeenCalled()
  })

  it('maps permission errors before start to a rejection', async () => {
    FakeRecognition.failOnStart = 'not-allowed'
    await expect(engine().start({ lang: 'pl-PL' })).rejects.toEqual(new SpeechError('permission-denied', 'not-allowed'))
  })

  it('reports network errors after start through onError', async () => {
    const onError = vi.fn()
    await engine().start({ lang: 'pl-PL', onError })
    last().fail('network')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' }))
  })

  it('restarts transparently in live mode when the browser ends recognition', async () => {
    const onRestart = vi.fn()
    const transcripts: string[] = []
    await engine().start({ lang: 'pl-PL', continuous: true, onRestart, onTranscript: (t) => transcripts.push(t) })
    const recognition = last()
    recognition.emit([true, 'Ojcze nasz'])
    recognition.endUnexpectedly()
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(recognition.startCalls).toBe(2)
    recognition.emit([false, 'Chleba'])
    expect(transcripts.at(-1)).toBe('Chleba')
  })

  it('stops restarting after too many consecutive browser stops', async () => {
    const onError = vi.fn()
    await engine().start({ lang: 'pl-PL', continuous: true, onError })
    for (let i = 0; i < 6; i++) last().endUnexpectedly()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'network' }))
  })

  it('treats an unexpected end in tap mode as silence', async () => {
    const onSilence = vi.fn()
    await engine().start({ lang: 'pl-PL', onSilence })
    last().endUnexpectedly()
    expect(onSilence).toHaveBeenCalledTimes(1)
  })

  it('refuses a second session while one is running', async () => {
    const e = engine()
    await e.start({ lang: 'pl-PL' })
    await expect(e.start({ lang: 'pl-PL' })).rejects.toMatchObject({ code: 'busy' })
  })

  it('collapses cumulative results on WebKit only', async () => {
    const safari = engine(SAFARI_UA)
    await safari.start({ lang: 'en-US' })
    last().emit([true, 'I am calm'], [true, 'I am calm and focused'])
    expect((await safari.stop()).alternatives[0]).toBe('I am calm and focused')

    const chrome = engine(CHROME_UA)
    await chrome.start({ lang: 'en-US' })
    last().emit([true, 'I am calm'], [true, 'I am calm'])
    expect((await chrome.stop()).alternatives[0]).toBe('I am calm I am calm')
  })

  it('returns an empty result when stopped while idle', async () => {
    expect((await engine().stop()).alternatives).toEqual([])
  })
})
