import { describe, expect, it } from 'vitest'
import {
  formatMegabytes,
  isWhisperModelId,
  modelBytes,
  modelFileUrls,
  WHISPER_DTYPE,
  WHISPER_MODEL_IDS,
  WHISPER_MODELS,
} from './models'

const spaces = (text: string) => text.replace(/\s/g, ' ')

describe('Whisper model catalogue', () => {
  it('offers the multilingual tiny and base models from onnx-community', () => {
    expect(WHISPER_MODEL_IDS).toEqual(['tiny', 'base'])
    expect(WHISPER_MODELS.tiny.repo).toBe('onnx-community/whisper-tiny')
    expect(WHISPER_MODELS.base.repo).toBe('onnx-community/whisper-base')
  })

  it('lists exactly the files transformers.js loads for the q8 speech pipeline', () => {
    expect(WHISPER_DTYPE).toBe('q8')
    for (const id of WHISPER_MODEL_IDS) {
      expect(WHISPER_MODELS[id].files.map((f) => f.path).sort()).toEqual([
        'config.json',
        'generation_config.json',
        'onnx/decoder_model_merged_quantized.onnx',
        'onnx/encoder_model_quantized.onnx',
        'preprocessor_config.json',
        'tokenizer.json',
        'tokenizer_config.json',
      ])
    }
  })

  it('knows the approximate download sizes', () => {
    expect(modelBytes('tiny')).toBeGreaterThan(43e6)
    expect(modelBytes('tiny')).toBeLessThan(45e6)
    expect(modelBytes('base')).toBeGreaterThan(79e6)
    expect(modelBytes('base')).toBeLessThan(81e6)
  })

  it('builds the Hugging Face URLs transformers.js uses as cache keys', () => {
    expect(modelFileUrls('base')).toContain(
      'https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/encoder_model_quantized.onnx',
    )
    expect(modelFileUrls('tiny')).toContain('https://huggingface.co/onnx-community/whisper-tiny/resolve/main/config.json')
    expect(modelFileUrls('tiny')).toHaveLength(7)
  })

  it('recognises model ids', () => {
    expect(isWhisperModelId('base')).toBe(true)
    expect(isWhisperModelId('small')).toBe(false)
    expect(isWhisperModelId(undefined)).toBe(false)
  })
})

describe('formatMegabytes', () => {
  it('rounds large sizes to whole megabytes', () => {
    expect(spaces(formatMegabytes(106_525_968, 'en'))).toBe('107 MB')
    expect(spaces(formatMegabytes(43_613_734, 'pl'))).toBe('44 MB')
  })

  it('keeps one decimal below 10 MB, in the locale’s notation', () => {
    expect(spaces(formatMegabytes(2_500_000, 'pl'))).toBe('2,5 MB')
    expect(spaces(formatMegabytes(2_500_000, 'en'))).toBe('2.5 MB')
  })
})
