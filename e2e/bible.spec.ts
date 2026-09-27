import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test('a Bible reading is said to the end, counts for the challenge and leads to the next one', async ({ page }) => {
  test.setTimeout(120_000)
  await installFakeSpeech(page, { live: true, wordDelayMs: 5 })
  await finishOnboarding(page)
  await page.getByRole('navigation').getByRole('link', { name: /Biblioteka|Library/ }).click()
  await page.getByRole('link', { name: /^(Biblia|The Bible)/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Całe Pismo, na głos|The whole Bible, aloud/)
  await page.getByRole('button', { name: /Czytaj dalej|Read next/ }).click()

  await expect(page.getByTestId('segment-text')).toBeVisible()
  await page.getByRole('button', { name: /^(Mów|Speak)$/ }).click()
  await page.getByRole('button', { name: /Rozumiem – dalej|I understand — continue/ }).click()
  await page.waitForURL(/summary$/, { timeout: 90_000 })
  await expect(page.getByText(/Weź i czytaj|Take Up and Read/)).toBeVisible()
  await expect(page.getByText(/Biblii przeczytane na głos|of the Bible read aloud/).first()).toBeVisible()

  await page.getByRole('button', { name: /Następne czytanie|Next reading/ }).click()
  await expect(page).toHaveURL(/#\/play\/[^/]+$/)
  await expect(page.getByTestId('segment-text')).toBeVisible()
})
