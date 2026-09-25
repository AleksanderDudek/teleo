import { describe, expect, it } from 'vitest'
import { containsSpeech, createSilenceDetector, rms, type SilenceDetector, type SilenceReason } from './silence'

const FRAME_MS = 50

/** Feeds `[level, durationMs]` segments frame by frame; returns the verdicts with their time. */
function feed(detector: SilenceDetector, segments: Array<[number, number]>, start = 0) {
  const verdicts: Array<{ at: number; reason: SilenceReason }> = []
  let t = start
  for (const [level, duration] of segments) {
    for (let elapsed = 0; elapsed < duration; elapsed += FRAME_MS) {
      const reason = detector.push(level, t)
      if (reason) verdicts.push({ at: t, reason })
      t += FRAME_MS
    }
  }
  return verdicts
}

const QUIET = 0.001
const SPEECH = 0.1

describe('rms', () => {
  it('is the root mean square of the samples', () => {
    expect(rms(Float32Array.of(0.5, -0.5, 0.5, -0.5))).toBeCloseTo(0.5)
    expect(rms(Float32Array.of(0, 0))).toBe(0)
    expect(rms(new Float32Array(0))).toBe(0)
  })
})

describe('createSilenceDetector', () => {
  it('gives up after 8 s without any speech', () => {
    const detector = createSilenceDetector()
    expect(feed(detector, [[QUIET, 10_000]])).toEqual([{ at: 8_000, reason: 'no-speech' }])
    expect(detector.heardSpeech).toBe(false)
  })

  it('ends 1.5 s after the last speech', () => {
    const detector = createSilenceDetector()
    // speech frames at 500 … 1450 ms → silence verdict at 1450 + 1500
    expect(feed(detector, [[QUIET, 500], [SPEECH, 1_000], [QUIET, 3_000]])).toEqual([{ at: 2_950, reason: 'speech-ended' }])
    expect(detector.heardSpeech).toBe(true)
  })

  it('does not end the utterance on a short pause between words', () => {
    const detector = createSilenceDetector()
    const verdicts = feed(detector, [[QUIET, 300], [SPEECH, 600], [QUIET, 800], [SPEECH, 600], [QUIET, 2_000]])
    expect(verdicts).toEqual([{ at: 3_750, reason: 'speech-ended' }])
  })

  it('ignores clicks shorter than a syllable (e.g. tapping the phone)', () => {
    const detector = createSilenceDetector()
    expect(feed(detector, [[QUIET, 1_000], [0.4, 50], [QUIET, 9_000]])).toEqual([{ at: 8_000, reason: 'no-speech' }])
  })

  it('adapts to steady background noise', () => {
    const detector = createSilenceDetector()
    const verdicts = feed(detector, [[0.02, 1_000], [0.15, 1_000], [0.02, 3_000]])
    expect(verdicts).toEqual([{ at: 3_450, reason: 'speech-ended' }])
  })

  it('stops a never-ending utterance after 60 s', () => {
    const detector = createSilenceDetector()
    const syllables: Array<[number, number]> = []
    for (let i = 0; i < 200; i++) syllables.push([SPEECH, 250], [0.01, 100])
    expect(feed(detector, syllables)).toEqual([{ at: 60_000, reason: 'max-duration' }])
  })

  it('reports only once', () => {
    const detector = createSilenceDetector({ noSpeechMs: 1_000 })
    expect(feed(detector, [[QUIET, 5_000]])).toHaveLength(1)
  })

  it('accepts custom timings', () => {
    const detector = createSilenceDetector({ silenceMs: 500 })
    expect(feed(detector, [[QUIET, 200], [SPEECH, 500], [QUIET, 1_000]])).toEqual([{ at: 1_150, reason: 'speech-ended' }])
  })

  it('treats a steady sound from the first frame as noise until it dips', () => {
    const detector = createSilenceDetector()
    expect(feed(detector, [[0.05, 9_000]])).toEqual([{ at: 8_000, reason: 'no-speech' }])
    expect(detector.heardSpeech).toBe(false)
  })
})

describe('containsSpeech', () => {
  const RATE = 16_000
  const tone = (seconds: number, amplitude: number) =>
    Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE))
  const join = (...parts: Float32Array[]) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const part of parts) {
      out.set(part, offset)
      offset += part.length
    }
    return out
  }

  it('finds speech anywhere in a recording', () => {
    expect(containsSpeech(join(tone(1, 0.001), tone(1, 0.2), tone(1, 0.001)), RATE)).toBe(true)
    expect(containsSpeech(join(tone(9, 0.001), tone(1, 0.2)), RATE)).toBe(true)
  })

  it('rejects silence and a lone click', () => {
    expect(containsSpeech(tone(3, 0.001), RATE)).toBe(false)
    expect(containsSpeech(join(tone(1, 0.001), tone(0.03, 0.5), tone(1, 0.001)), RATE)).toBe(false)
    expect(containsSpeech(new Float32Array(0), RATE)).toBe(false)
  })
})
