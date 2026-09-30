import { expect, test, type Page } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

/** A silent speechSynthesis that finishes each line at once (headless browsers have no voices). */
async function installFakeVoice(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = []
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [],
      cancel() {},
      pause() {},
      resume() {},
      speak(utterance: { text: string; onend?: ((event: Event) => void) | null }) {
        spoken.push(utterance.text)
        setTimeout(() => utterance.onend?.(new Event('end')), 20)
      },
      addEventListener() {},
      removeEventListener() {},
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    if (!('SpeechSynthesisUtterance' in window)) {
      Object.assign(window, {
        SpeechSynthesisUtterance: class {
          text: string
          lang = ''
          rate = 1
          voice = null
          onend = null
          onerror = null
          constructor(text: string) {
            this.text = text
          }
        },
      })
    }
    Object.assign(window, { __spoken: spoken })
  })
}

test('a language dialogue: the partner speaks, the user answers aloud, the summary offers the next one', async ({ page }) => {
  test.setTimeout(120_000)
  await installFakeSpeech(page, { live: true, wordDelayMs: 5 })
  await installFakeVoice(page)
  await finishOnboarding(page)

  await page.getByRole('navigation').getByRole('link', { name: /Biblioteka|Library/ }).click()
  await page.getByRole('link', { name: /Rozmowy po angielsku|Conversations in Polish/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Rozmowy po angielsku|Conversations in Polish/)
  await page.getByRole('button', { name: /W kawiarni|At the café/ }).click()

  // The partner opens in the language being learnt (English for Polish users, Polish for English users).
  const chat = page.getByRole('log')
  await expect(chat).toContainText(/What can I get you\?|Co mogę podać\?/)
  // The user's line: the words to say, how to say them, and what they mean.
  await expect(page.getByTestId('segment-text')).toHaveText(/I’d like a large coffee with milk, please\.|Poproszę dużą kawę z mlekiem\./)
  await expect(chat).toContainText(/ajd lajk e lardż KO-fi|po-PRO-sheh DOO-zhom KA-veh/)
  await expect(chat.locator('.gloss-word[data-role="adjective"]').first()).toBeVisible()

  await page.getByRole('button', { name: /^(Mów|Speak)$/ }).click()
  await page.getByRole('button', { name: /Rozumiem – dalej|I understand — continue/ }).click()

  await page.waitForURL(/summary$/, { timeout: 90_000 })
  await expect(page.getByText(/W kawiarni|At the café/).first()).toBeVisible()
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)
  // The partner's last line was said aloud before the summary opened.
  expect(spoken.some((line) => /You too!|Wzajemnie!/.test(line))).toBe(true)

  await page.getByRole('button', { name: /Następna rozmowa|Next conversation/ }).click()
  await expect(page).toHaveURL(/#\/play\/[^/]+$/)
  await expect(page.getByRole('log')).toContainText(/Hello! Can I help you\?|Mogę w czymś pomóc\?/)
})
