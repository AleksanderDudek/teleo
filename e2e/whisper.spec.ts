import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test('settings offer the offline Whisper download, with its size, without contacting Hugging Face', async ({ page }) => {
  const huggingFace: string[] = []
  page.on('request', (request) => {
    if (/huggingface\.co|\.hf\.co/.test(request.url())) huggingFace.push(request.url())
  })
  // Playwright's headless shell has no speech service and crashes on SpeechRecognition.available().
  await installFakeSpeech(page)
  await finishOnboarding(page)
  await page.goto('./#/settings?section=speech')

  const speech = page.locator('#speech')
  await expect(speech.getByText(/^Base · 107 MB$/)).toBeVisible()
  await speech.getByRole('button', { name: /^(Pobierz|Download) \(107 MB\)$/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('huggingface.co')
  await expect(dialog).toContainText(/Wi-Fi/)
  await dialog.getByRole('button', { name: /Anuluj|Cancel/ }).click()

  expect(huggingFace).toEqual([])
})
