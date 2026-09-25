import type { SpeechLang } from '@/domain/types'

/** Text-to-speech for "listen first" (spec §7.3) using the free speechSynthesis API. */
export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function'
}

function voiceFor(lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const prefix = lang.slice(0, 2).toLowerCase()
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix))
  return voices.find((v) => v.lang === lang && v.localService) ?? voices.find((v) => v.localService) ?? voices[0]
}

/**
 * Reads `text` aloud; resolves when finished, cancelled or failed (never rejects).
 * Some engines never fire `end` (long utterances, missing voices), so a generous
 * time limit based on the word count resolves it anyway.
 */
export function speak(text: string, lang: SpeechLang): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve()
    const words = text.split(/\s+/).length
    const limit = window.setTimeout(done, 3000 + words * 800)
    function done() {
      window.clearTimeout(limit)
      resolve()
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.92
    const voice = voiceFor(lang)
    if (voice) utterance.voice = voice
    utterance.onend = done
    utterance.onerror = done
    synth.speak(utterance)
  })
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}
