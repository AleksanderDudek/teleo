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
    await page.getByRole('switch', { name: 'Na żywo' }).click() // live listening is the default
    await expect(page.getByRole('switch', { name: 'Na żywo' })).toHaveAttribute('aria-checked', 'false')
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

test.describe('live mode', () => {
  test.use({ locale: 'pl-PL' })

  test('a PL rosary decade completes hands-free, sentence after sentence', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    await installFakeSpeech(page, { live: true, wordDelayMs: 25 })
    await finishOnboarding(page)
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click()
    await expect(page.getByRole('switch', { name: 'Na żywo' })).toBeVisible()
    await page.getByRole('button', { name: 'Mów' }).click()
    await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()
    await expect(page.getByText('Zdrowaś Maryjo · 3/10')).toBeVisible({ timeout: 60_000 })
    await page.screenshot({ path: testInfo.outputPath('live-player.png') })
    await page.waitForURL(/summary$/, { timeout: 120_000 })
    await expect(page.getByText('26/26')).toBeVisible()
    await expect(page.getByText('100%')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('live-summary.png'), fullPage: true })

    await page.getByRole('link', { name: 'Wróć do ekranu Dziś' }).click()
    await page.getByRole('navigation').getByRole('link', { name: 'Postępy' }).click()
    await expect(page.getByRole('heading', { name: 'Twój ogród' })).toBeVisible()
    await page.waitForTimeout(1200) // let entrance animations settle for the screenshot
    await page.screenshot({ path: testInfo.outputPath('progress.png'), fullPage: true })
  })

  test('a slipped sentence repeated at once counts as one failed and one accepted attempt', async ({ page }) => {
    test.setTimeout(180_000)
    await installFakeSpeech(page, { live: true, wordDelayMs: 25 })
    await finishOnboarding(page)
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click()
    await page.evaluate(() => {
      const fake = (window as unknown as { __fakeSpeech: { queue: string[] } }).__fakeSpeech
      fake.queue.push('Ojcze nasz któryś jest bardzo w niebie')
    })
    await page.getByRole('button', { name: 'Mów' }).click()
    await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()
    await page.waitForURL(/summary$/, { timeout: 120_000 })
    await expect(page.getByText('26/26')).toBeVisible()
    await expect(page.getByText('96%')).toBeVisible() // 25 of 26 on the first try
  })
})

test.describe('memory mode', () => {
  test.use({ locale: 'pl-PL' })

  test('a text said from memory at the hidden level earns “Na pamięć”', async ({ page }) => {
    test.setTimeout(120_000)
    await installFakeSpeech(page, { live: true, wordDelayMs: 20 })
    await finishOnboarding(page)
    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    await page.getByRole('link', { name: /Chwała Ojcu/ }).click()
    await page.getByRole('button', { name: 'Z pamięci' }).click()
    await page.getByText('Tekst ukryty', { exact: true }).click()
    await page.getByRole('button', { name: 'Rozpocznij' }).click()
    await expect(page).toHaveURL(/#\/play\//)
    await expect(page.getByText('Z pamięci · Tekst ukryty')).toBeVisible()
    await expect(page.getByTestId('segment-text')).not.toContainText('Chwała')
    // The fake speaker knows the prayer by heart even though the screen shows only dots.
    await page.evaluate(() => {
      const fake = (window as unknown as { __fakeSpeech: { queue: string[] } }).__fakeSpeech
      fake.queue.push('Chwała Ojcu i Synowi, i Duchowi Świętemu.', 'Jak była na początku, teraz i zawsze, i na wieki wieków. Amen.')
    })
    await page.getByRole('button', { name: 'Mów' }).click()
    await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()
    await page.waitForURL(/summary$/, { timeout: 60_000 })
    await expect(page.getByText('Na pamięć')).toBeVisible()
  })
})

test.describe('English', () => {
  test.use({ locale: 'en-US' })

  test('an EN “Morning affirmations” session completes hands-free', async ({ page }) => {
    test.setTimeout(120_000)
    await installFakeSpeech(page, { live: true, wordDelayMs: 20 })
    await page.goto('./')
    await page.getByRole('button', { name: 'English' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: /^Affirmations/ }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByText('Morning affirmations · 10 sentences')).toBeVisible()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByTestId('segment-text')).toHaveText('I am calm and focused.')
    await page.getByRole('button', { name: 'Speak' }).click()
    await page.getByRole('button', { name: 'I understand — continue' }).click()
    await page.waitForURL(/summary$/, { timeout: 60_000 })
    await expect(page.getByText('10/10')).toBeVisible()
    await expect(page.getByText('First Word')).toBeVisible()
  })
})
