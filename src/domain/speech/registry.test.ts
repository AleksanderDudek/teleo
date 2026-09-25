import { describe, expect, it } from 'vitest'
import { pickEngine, resolveEngine, unavailableReason, webSpeechEngine, whisperEngine, type EngineCandidates } from './registry'
import type { SpeechEngine } from './SpeechEngine'

function fakeEngine(id: 'webspeech' | 'whisper', supported: boolean, canRun = supported): SpeechEngine & { canRun(): boolean } {
  return {
    id,
    isSupported: async () => supported,
    canRun: () => canRun,
    start: async () => {},
    stop: async () => ({ alternatives: [], durationMs: 0, engine: id }),
    abort: () => {},
  }
}

const engines = (web: boolean, whisper: boolean, whisperCanRun = whisper): EngineCandidates => ({
  web: fakeEngine('webspeech', web),
  whisper: fakeEngine('whisper', whisper, whisperCanRun),
})

describe('pickEngine', () => {
  it('auto: prefers Web Speech when the browser has it', async () => {
    expect((await pickEngine('auto', engines(true, true)))?.id).toBe('webspeech')
  })

  it('auto: falls back to Whisper when its model is downloaded (e.g. Firefox)', async () => {
    expect((await pickEngine('auto', engines(false, true)))?.id).toBe('whisper')
  })

  it('auto: nothing when neither works', async () => {
    expect(await pickEngine('auto', engines(false, false, true))).toBeNull()
  })

  it('whisper: only with a downloaded model, even when Web Speech exists', async () => {
    expect((await pickEngine('whisper', engines(true, true)))?.id).toBe('whisper')
    expect(await pickEngine('whisper', engines(true, false, true))).toBeNull()
  })

  it('webspeech: only Web Speech', async () => {
    expect((await pickEngine('webspeech', engines(true, true)))?.id).toBe('webspeech')
    expect(await pickEngine('webspeech', engines(false, true))).toBeNull()
  })
})

describe('unavailableReason', () => {
  it('asks for the model download when Whisper was chosen and can run here', () => {
    expect(unavailableReason('whisper', engines(false, false, true))).toBe('model-missing')
  })

  it('reports lack of support otherwise', () => {
    expect(unavailableReason('whisper', engines(false, false, false))).toBe('not-supported')
    expect(unavailableReason('auto', engines(false, false, true))).toBe('not-supported')
    expect(unavailableReason('webspeech', engines(false, true))).toBe('not-supported')
  })
})

describe('shared engines', () => {
  it('hands out one instance of each engine', () => {
    expect(webSpeechEngine()).toBe(webSpeechEngine())
    expect(whisperEngine()).toBe(whisperEngine())
  })

  it('points the Whisper engine at the model chosen in Settings', async () => {
    // Node has no Worker or microphone: nothing is usable, but the model choice sticks.
    expect(await resolveEngine('whisper', 'tiny')).toBeNull()
    expect(whisperEngine().model).toBe('tiny')
    await resolveEngine('auto', 'base')
    expect(whisperEngine().model).toBe('base')
  })
})
