import type { SpeechLang } from '@/domain/types'

/** Whisper's input: 16 kHz mono PCM. */
export const WHISPER_SAMPLE_RATE = 16_000

/** One Whisper window; longer recordings are transcribed in overlapping chunks. */
const WINDOW_S = 30
const STRIDE_S = 5
/** Decoder limit of Whisper (448 positions) minus the 4 prompt tokens and some slack. */
const MAX_TOKENS = 440
/** Fast recitation in Polish stays well under ~12 tokens/s; generous so no real speech is cut. */
const TOKENS_PER_SECOND = 16
const TOKEN_SLACK = 24

export type WhisperLanguage = 'polish' | 'english'

const LANGUAGES: Record<SpeechLang, WhisperLanguage> = { 'pl-PL': 'polish', 'en-US': 'english' }

/** The recognition language is always forced: auto-detection wastes time and misfires on short phrases. */
export function whisperLanguage(lang: SpeechLang): WhisperLanguage {
  return LANGUAGES[lang]
}

/** Options for the transformers.js `automatic-speech-recognition` pipeline call (a type alias: it must fit an index signature). */
export type WhisperGenerateOptions = {
  language: WhisperLanguage
  task: 'transcribe'
  max_new_tokens: number
  chunk_length_s?: number
  stride_length_s?: number
}

export function generateOptions(lang: SpeechLang, sampleCount: number): WhisperGenerateOptions {
  const seconds = sampleCount / WHISPER_SAMPLE_RATE
  const options: WhisperGenerateOptions = {
    language: whisperLanguage(lang),
    task: 'transcribe',
    // Whisper can loop ("że to jest to, że to jest to, …") on noise; the cap ends such runs early.
    max_new_tokens: Math.min(MAX_TOKENS, Math.ceil(seconds * TOKENS_PER_SECOND) + TOKEN_SLACK),
  }
  if (seconds > WINDOW_S) {
    options.chunk_length_s = WINDOW_S
    options.stride_length_s = STRIDE_S
  }
  return options
}

/** Subtitle credits from Whisper's training data, emitted on silence or noise — never real speech here. */
const SUBTITLE_CREDITS = /amara\.org|napisy (stworzone|wykonane|przygotowane) przez/i

/** Normalises Whisper output: no non-speech tags (`[BLANK_AUDIO]`, `[Muzyka]`), no hallucinated credits. */
export function cleanTranscript(text: string): string {
  const cleaned = text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return SUBTITLE_CREDITS.test(cleaned) ? '' : cleaned
}
