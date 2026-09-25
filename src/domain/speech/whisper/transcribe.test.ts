import { describe, expect, it } from 'vitest'
import { cleanTranscript, generateOptions, WHISPER_SAMPLE_RATE, whisperLanguage } from './transcribe'

const seconds = (s: number) => Math.round(s * WHISPER_SAMPLE_RATE)

describe('whisperLanguage', () => {
  it('forces the language of the text being spoken', () => {
    expect(whisperLanguage('pl-PL')).toBe('polish')
    expect(whisperLanguage('en-US')).toBe('english')
  })
})

describe('generateOptions', () => {
  it('transcribes (never translates) in the forced language', () => {
    expect(generateOptions('pl-PL', seconds(4))).toMatchObject({ language: 'polish', task: 'transcribe' })
  })

  it('caps the output length by the audio length so a hallucination loop cannot run away', () => {
    expect(generateOptions('en-US', seconds(5)).max_new_tokens).toBe(104)
    expect(generateOptions('en-US', seconds(0.4)).max_new_tokens).toBe(31)
    expect(generateOptions('en-US', seconds(60)).max_new_tokens).toBe(440)
  })

  it('processes one 30-second window without chunking', () => {
    const options = generateOptions('pl-PL', seconds(30))
    expect(options.chunk_length_s).toBeUndefined()
    expect(options.stride_length_s).toBeUndefined()
  })

  it('chunks recordings longer than Whisper’s 30-second window', () => {
    expect(generateOptions('pl-PL', seconds(45))).toMatchObject({ chunk_length_s: 30, stride_length_s: 5 })
  })
})

describe('cleanTranscript', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanTranscript('  Chleba  naszego\npowszedniego ')).toBe('Chleba naszego powszedniego')
  })

  it('drops non-speech tags', () => {
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('')
    expect(cleanTranscript(' [Muzyka] Dzień dobry.')).toBe('Dzień dobry.')
  })

  it('drops the subtitle credits Whisper hallucinates on noise', () => {
    expect(cleanTranscript(' Napisy stworzone przez społeczność Amara.org')).toBe('')
    expect(cleanTranscript('Subtitles by the Amara.org community')).toBe('')
  })

  it('keeps short genuine phrases', () => {
    expect(cleanTranscript(' Dziękuję.')).toBe('Dziękuję.')
    expect(cleanTranscript(' Thank you.')).toBe('Thank you.')
  })
})
