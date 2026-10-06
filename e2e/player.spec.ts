import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test.use({ locale: 'pl-PL' })

test('a failed try at a long Bible sentence keeps the microphone on screen and the verdict on the sentence', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await installFakeSpeech(page, { live: true, wordDelayMs: 5 })
  await finishOnboarding(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
  await page.getByRole('link', { name: /^Biblia/ }).click()
  await page.getByRole('button', { name: 'Czytaj dalej' }).click()

  // The first sentence is said right; the second (Genesis 1:2, 18 words) again and again with words swapped and added.
  const stage = page.getByTestId('segment-text')
  const first = (await stage.getAttribute('data-source')) ?? ''
  const second = 'A ziemia była niekształtowna i próżna, i ciemność była nad przepaścią, a Duch Boży unaszał się nad wodami.'
  const wrong = (n: number) => `${second.replace(/[.,]/g, '').replace('ciemność', 'banan').replace('wodami', 'górami')} raz dwa${' trzy'.repeat(n)}`
  await page.evaluate((queue) => {
    ;(window as unknown as { __fakeSpeech: { queue: string[] } }).__fakeSpeech.queue = queue
  }, [first, ...Array.from({ length: 30 }, (_, n) => wrong(n + 1))])
  await page.getByRole('button', { name: 'Mów' }).click()
  await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()

  const feedback = page.getByTestId('player-feedback').locator('.card')
  await expect(feedback).toBeVisible({ timeout: 20_000 })
  await expect(stage).toHaveAttribute('data-source', second)
  // Hold the screen on the verdict: stop listening.
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mów' })).toBeVisible()

  // The verdict is drawn on the sentence: words heard instead of the text (→) or added to it (+) show where they were said.
  await expect(stage).toContainText(/[+→]/)
  // The page itself never scrolls: the microphone is fully on screen, the feedback right above it.
  const viewport = page.viewportSize()!
  const mic = (await page.getByRole('button', { name: 'Mów' }).boundingBox())!
  const card = (await feedback.boundingBox())!
  expect(mic.y).toBeGreaterThanOrEqual(0)
  expect(mic.y + mic.height).toBeLessThanOrEqual(viewport.height)
  expect(card.y).toBeGreaterThanOrEqual(0)
  expect(card.y + card.height).toBeLessThanOrEqual(mic.y)
  const scroll = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: window.innerHeight }))
  expect(scroll.height).toBeLessThanOrEqual(scroll.viewport + 1)
  await page.screenshot({ path: testInfo.outputPath('long-sentence-feedback.png') })
})
