import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test.describe('onboarding', () => {
  test.use({ locale: 'pl-PL' })

  test('English + affirmations + goal 20 shapes the library and the Start button', async ({ page }) => {
    // Playwright's headless shell has no speech service and crashes on SpeechRecognition.available().
    await installFakeSpeech(page)
    await page.goto('./')
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { name: 'Which language should Teleo speak?' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: /^Affirmations/ }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Let’s test the microphone' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: '20 sentences' }).click()
    await page.getByRole('button', { name: 'Get started' }).click()

    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByText('Morning affirmations · 10 sentences')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Today’s goal' })).toHaveAttribute('aria-valuemax', '20')
    await page.getByRole('navigation').getByRole('link', { name: 'Library' }).click()
    await expect(page.getByRole('link', { name: /Morning/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ojcze nasz/ })).toHaveCount(0)
  })
})

test.describe('data', () => {
  test.use({ locale: 'pl-PL', acceptDownloads: true })

  test('backup export → delete everything → import restores the history', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    await installFakeSpeech(page, { live: true, wordDelayMs: 10 })
    await finishOnboarding(page)
    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    await page.getByRole('link', { name: /Chwała Ojcu/ }).click()
    await page.getByRole('button', { name: 'Powiedz teraz' }).click()
    await page.getByRole('button', { name: 'Mów' }).click()
    await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()
    await page.waitForURL(/summary$/)
    await page.getByRole('link', { name: 'Wróć do ekranu Dziś' }).click()
    await expect(page.getByText('1 dzień z rzędu')).toBeVisible()

    await page.getByRole('navigation').getByRole('link', { name: 'Ustawienia' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Eksportuj kopię' }).click()])
    const file = testInfo.outputPath('backup.json')
    await download.saveAs(file)
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ app: 'teleo', schemaVersion: 1 })

    await page.getByRole('button', { name: 'Usuń wszystkie dane' }).click()
    await page.getByRole('dialog').getByRole('textbox').fill('USUŃ')
    await page.getByRole('button', { name: 'Usuń wszystko' }).click()
    await expect(page).toHaveURL(/#\/onboarding$/)
    await finishOnboarding(page)
    await expect(page.getByText('Zacznij dziś serię')).toBeVisible()

    await page.goto('./#/settings')
    await page.locator('input[type="file"]').setInputFiles(file)
    await page.getByRole('button', { name: 'Zastąp i przywróć' }).click()
    await expect(page.getByText('1 dzień z rzędu')).toBeVisible({ timeout: 15_000 })
  })

  test('the installed app shell opens offline', async ({ page, context }) => {
    await finishOnboarding(page)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload() // now controlled by the service worker
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Rozpocznij', exact: true })).toBeVisible()
    await context.setOffline(false)
  })

  test('privacy policy is reachable from settings', async ({ page }) => {
    await finishOnboarding(page)
    await page.goto('./#/settings')
    const [policy] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Polityka prywatności' }).click()])
    await expect(policy.getByRole('heading', { name: 'Teleo – modlitwy i afirmacje' })).toBeVisible()
  })
})
