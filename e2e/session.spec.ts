import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test.describe('tap mode', () => {
  test.use({ locale: 'pl-PL' })

  test('a PL rosary decade runs end to end with correct counters', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    await installFakeSpeech(page)
    await finishOnboarding(page)
    await page.screenshot({ path: testInfo.outputPath('today.png'), fullPage: true })

    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click()
    await expect(page).toHaveURL(/#\/play\//)
    await expect(page.getByTestId('segment-text')).toContainText('Ojcze nasz')
    await page.screenshot({ path: testInfo.outputPath('player.png') })

    const mic = page.getByRole('button', { name: 'Mów' })
    await mic.click()
    await page.getByRole('button', { name: 'Rozumiem – dalej' }).click() // first-use privacy notice

    for (let next = 2; next <= 26; next++) {
      await expect(page.getByRole('progressbar', { name: `Zdanie ${next} z 26` })).toBeVisible({ timeout: 10_000 })
      await expect(mic).toBeEnabled({ timeout: 10_000 })
      await mic.click()
    }
    await page.waitForURL(/summary$/, { timeout: 20_000 })
    await expect(page.getByText('26/26')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('summary.png'), fullPage: true })

    await page.getByRole('link', { name: 'Wróć do ekranu Dziś' }).click()
    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    await page.getByRole('link', { name: /Zdrowaś Maryjo/ }).click()
    await expect(page.getByRole('term').filter({ hasText: 'Powtórzenia' }).locator('..')).toContainText('10')
  })
})
