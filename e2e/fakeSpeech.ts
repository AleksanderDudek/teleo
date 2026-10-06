import type { Page } from '@playwright/test'

/**
 * Installs a scriptable `SpeechRecognition` before the app loads.
 * - echo mode (default): each utterance "says" the sentence currently on screen
 *   (`[data-testid="segment-text"]`, its `data-source`).
 * - live mode: words are streamed one by one as interim results inside ONE
 *   continuous recognition, then finalised.
 * `window.__fakeSpeech.queue` (array) overrides the next utterances in order.
 */
export async function installFakeSpeech(page: Page, options: { live?: boolean; wordDelayMs?: number } = {}) {
  await page.addInitScript(({ live, wordDelayMs }) => {
    type Handler = ((event?: unknown) => void) | null
    const state = { queue: [] as string[], started: 0, live, wordDelayMs }
    ;(window as unknown as { __fakeSpeech: typeof state }).__fakeSpeech = state

    // The sentence itself, not what the stage shows over it (a coloured verdict, masked words in memory mode).
    const onScreen = () => {
      const stage = document.querySelector('[data-testid="segment-text"]')
      return (stage?.getAttribute('data-source') ?? stage?.textContent ?? '').trim()
    }
    const currentSentence = () => state.queue.shift() ?? onScreen()

    const resultList = (texts: Array<{ text: string; final: boolean }>) => {
      const list = texts.map(({ text, final }) => Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: final }))
      return Object.assign(list, { item: (i: number) => list[i] })
    }

    class FakeSpeechRecognition {
      lang = ''
      continuous = false
      interimResults = false
      maxAlternatives = 1
      onstart: Handler = null
      onresult: Handler = null
      onerror: Handler = null
      onend: Handler = null
      private running = false

      start() {
        this.running = true
        state.started++
        setTimeout(() => {
          this.onstart?.()
          if (state.live) this.streamLive()
          else this.speakOnce()
        }, 30)
      }

      private speakOnce() {
        setTimeout(() => {
          if (!this.running) return
          const text = currentSentence()
          this.onresult?.({ resultIndex: 0, results: resultList([{ text, final: true }]) })
          // Browsers end a recognition shortly after the speaker stops.
          setTimeout(() => this.finish(), 60)
        }, 120)
      }

      private async streamLive() {
        const finals: string[] = []
        let spokenFor = ''
        while (this.running) {
          const sentence = currentSentence()
          if (!sentence || sentence === spokenFor) {
            await new Promise((r) => setTimeout(r, 80))
            continue
          }
          spokenFor = sentence
          const words = sentence.split(/\s+/)
          for (let i = 1; i <= words.length && this.running; i++) {
            const interim = words.slice(0, i).join(' ')
            this.onresult?.({ resultIndex: finals.length, results: resultList([...finals.map((text) => ({ text, final: true })), { text: interim, final: false }]) })
            await new Promise((r) => setTimeout(r, state.wordDelayMs ?? 40))
          }
          finals.push(sentence)
          this.onresult?.({ resultIndex: finals.length - 1, results: resultList(finals.map((text) => ({ text, final: true }))) })
          await new Promise((r) => setTimeout(r, 150))
        }
      }

      private finish() {
        if (!this.running) return
        this.running = false
        this.onend?.()
      }

      stop() {
        const wasRunning = this.running
        this.running = false
        setTimeout(() => wasRunning && this.onend?.(), 20)
        if (!wasRunning) setTimeout(() => this.onend?.(), 20)
      }

      abort() {
        this.stop()
      }
    }
    Object.assign(window, { SpeechRecognition: FakeSpeechRecognition, webkitSpeechRecognition: FakeSpeechRecognition })
  }, { live: options.live ?? false, wordDelayMs: options.wordDelayMs ?? 40 })
}

/** Completes the onboarding (skips everything). */
export async function finishOnboarding(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: /Zaczynamy|Get started|Pomiń|Skip/ }).first().click()
  await page.waitForURL(/#\/$/)
}
