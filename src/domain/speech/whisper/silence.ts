/**
 * Energy-based voice activity detection for the offline engine: decides when
 * an utterance ended (spec §5.3 capture). Fed with the RMS level of short
 * frames (~50 ms) from an AnalyserNode, or of a finished recording.
 *
 * A frame counts as speech when its level is at least `noiseFactor` × the
 * noise floor (the quietest frame of the last `floorWindowMs`) and above
 * `minLevel`. Speech must last `onsetMs` before it counts, so a click (tapping
 * the phone) is ignored; a steady sound without any dip is treated as noise.
 */
export interface SilenceConfig {
  /** Quiet time after speech that ends the utterance. */
  silenceMs: number
  /** Give up when no speech was heard at all for this long. */
  noSpeechMs: number
  /** Hard cap for one utterance. */
  maxMs: number
  /** Absolute level (RMS, samples in [-1, 1]) below which nothing is speech (≈ −42 dBFS). */
  minLevel: number
  /** Speech must be this many times louder than the noise floor (≈ +9.5 dB). */
  noiseFactor: number
  /** How long a level must stay up before it counts as speech. */
  onsetMs: number
  /** Window of the running minimum that estimates the noise floor. */
  floorWindowMs: number
}

export const DEFAULT_SILENCE_CONFIG: SilenceConfig = {
  silenceMs: 1_500,
  noSpeechMs: 8_000,
  maxMs: 60_000,
  minLevel: 0.008,
  noiseFactor: 3,
  onsetMs: 150,
  floorWindowMs: 5_000,
}

export type SilenceReason = 'speech-ended' | 'no-speech' | 'max-duration'

export interface SilenceDetector {
  /** Feeds one frame level; returns a verdict exactly once, then `null` forever. */
  push(level: number, atMs: number): SilenceReason | null
  readonly heardSpeech: boolean
}

export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!
    sum += sample * sample
  }
  return Math.sqrt(sum / samples.length)
}

export function createSilenceDetector(overrides: Partial<SilenceConfig> = {}): SilenceDetector {
  const config = { ...DEFAULT_SILENCE_CONFIG, ...overrides }
  const history: Array<{ at: number; level: number }> = []
  let startedAt: number | undefined
  let aboveSince: number | undefined
  let lastSpeechAt = 0
  let heardSpeech = false
  let done = false

  const verdict = (now: number, started: number): SilenceReason | null => {
    if (now - started >= config.maxMs) return 'max-duration'
    if (heardSpeech) return now - lastSpeechAt >= config.silenceMs ? 'speech-ended' : null
    return now - started >= config.noSpeechMs ? 'no-speech' : null
  }

  return {
    get heardSpeech() {
      return heardSpeech
    },
    push(level, atMs) {
      if (done) return null
      startedAt ??= atMs
      history.push({ at: atMs, level })
      while (history.length > 1 && history[0]!.at < atMs - config.floorWindowMs) history.shift()
      const floor = history.reduce((min, frame) => Math.min(min, frame.level), Infinity)
      const threshold = Math.max(config.minLevel, floor * config.noiseFactor)
      if (level >= threshold) {
        aboveSince ??= atMs
        if (heardSpeech || atMs - aboveSince >= config.onsetMs) {
          heardSpeech = true
          lastSpeechAt = atMs
        }
      } else {
        aboveSince = undefined
      }
      const reason = verdict(atMs, startedAt)
      if (reason) done = true
      return reason
    },
  }
}

const FRAME_MS = 50

/** Whether a finished recording contains speech at all (no transcription of silence: Whisper hallucinates on it). */
export function containsSpeech(samples: Float32Array, sampleRate: number, overrides: Partial<SilenceConfig> = {}): boolean {
  const detector = createSilenceDetector({ ...overrides, noSpeechMs: Infinity, maxMs: Infinity })
  const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000))
  for (let start = 0, index = 0; start < samples.length; start += frame, index++) {
    detector.push(rms(samples.subarray(start, start + frame)), index * FRAME_MS)
    if (detector.heardSpeech) return true
  }
  return false
}
