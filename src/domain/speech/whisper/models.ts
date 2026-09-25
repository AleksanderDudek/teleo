/**
 * Offline Whisper models (spec §5.3). Multilingual ONNX exports from the
 * `onnx-community` organisation on Hugging Face, loaded by transformers.js with
 * dtype `q8` (dynamically quantised int8: `*_quantized.onnx`), which runs on the
 * WebAssembly backend everywhere. Sizes checked against the Hub API
 * (`/api/models/<repo>/tree/main`) on 2026-09-25; they only feed the UI and the
 * progress bar, so small upstream changes are harmless.
 */
export type WhisperModelId = 'tiny' | 'base'
export const WHISPER_MODEL_IDS = ['tiny', 'base'] as const satisfies readonly WhisperModelId[]

/** transformers.js dtype → files with the `_quantized` suffix. */
export const WHISPER_DTYPE = 'q8'

/** `env.remoteHost` + `env.remotePathTemplate` of transformers.js (revision `main`). */
const HF_RESOLVE = (repo: string, path: string) => `https://huggingface.co/${repo}/resolve/main/${path}`

export interface ModelFile {
  readonly path: string
  readonly bytes: number
}

export interface WhisperModelSpec {
  readonly id: WhisperModelId
  readonly repo: string
  readonly files: readonly ModelFile[]
}

/** Every file the `automatic-speech-recognition` pipeline reads for a Whisper model with dtype q8. */
const files = (sizes: { generationConfig: number; tokenizerConfig: number; encoder: number; decoder: number }): ModelFile[] => [
  { path: 'config.json', bytes: 2_243 },
  { path: 'generation_config.json', bytes: sizes.generationConfig },
  { path: 'preprocessor_config.json', bytes: 339 },
  { path: 'tokenizer.json', bytes: 2_480_466 },
  { path: 'tokenizer_config.json', bytes: sizes.tokenizerConfig },
  { path: 'onnx/encoder_model_quantized.onnx', bytes: sizes.encoder },
  { path: 'onnx/decoder_model_merged_quantized.onnx', bytes: sizes.decoder },
]

export const WHISPER_MODELS: Record<WhisperModelId, WhisperModelSpec> = {
  tiny: {
    id: 'tiny',
    repo: 'onnx-community/whisper-tiny',
    files: files({ generationConfig: 3_772, tokenizerConfig: 282_683, encoder: 10_124_990, decoder: 30_719_241 }),
  },
  base: {
    id: 'base',
    repo: 'onnx-community/whisper-base',
    files: files({ generationConfig: 3_832, tokenizerConfig: 282_682, encoder: 23_201_314, decoder: 53_693_315 }),
  },
}

export function isWhisperModelId(value: unknown): value is WhisperModelId {
  return typeof value === 'string' && (WHISPER_MODEL_IDS as readonly string[]).includes(value)
}

/** Approximate size of the model files (without the speech runtime). */
export function modelBytes(id: WhisperModelId): number {
  return WHISPER_MODELS[id].files.reduce((sum, file) => sum + file.bytes, 0)
}

/** Hub URLs of a model's files — also the keys transformers.js stores them under in Cache Storage. */
export function modelFileUrls(id: WhisperModelId): string[] {
  const { repo, files } = WHISPER_MODELS[id]
  return files.map((file) => HF_RESOLVE(repo, file.path))
}

/** "107 MB" / "2,5 MB" (decimal megabytes, as download sizes are usually shown). */
export function formatMegabytes(bytes: number, locale: string): string {
  const megabytes = bytes / 1_000_000
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: megabytes < 10 ? 1 : 0,
  }).format(megabytes)
}
