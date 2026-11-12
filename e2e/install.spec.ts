import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech, readInstallOffer } from './fakeSpeech.ts'

/** Putting Teleo on the home screen (DECISIONS #140) — phones only; the PL phone projects. */
test.describe('install offer', () => {
  test.skip(({ isMobile }) => !isMobile, 'the offer opens by itself on phones only')

  test('the Today chip opens the guide; the first finished session offers it; "Nie teraz" is remembered', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    await installFakeSpeech(page, { live: true, wordDelayMs: 20 })
    await finishOnboarding(page, { keepInstallOffer: true })

    // Opened by hand: closing it is not a "Not now".
    await page.getByRole('button', { name: 'Zainstaluj', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: 'Teleo na ekranie głównym' })
    await expect(sheet).toBeVisible()
    if (testInfo.project.name === 'iphone-webkit') {
      await expect(sheet.getByRole('list', { name: 'Jak dodać Teleo' })).toBeVisible()
      await expect(sheet.getByText('Do ekranu początkowego').first()).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath('install-guide.png'), animations: 'disabled' })
    await sheet.getByRole('button', { name: 'Nie teraz' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await readInstallOffer(page)).toBeNull()

    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    await page.getByRole('link', { name: /^Chwała Ojcu(?! \()/ }).click()
    await page.getByRole('button', { name: 'Powiedz teraz' }).click()
    await expect(page).toHaveURL(/#\/play\//)
    await page.getByRole('button', { name: 'Mów' }).click()
    await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()
    await page.waitForURL(/summary$/, { timeout: 60_000 })

    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await sheet.getByRole('button', { name: 'Nie teraz' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => readInstallOffer(page)).toMatchObject({ dismissals: 1 })
  })

  test.describe('in an app’s built-in browser', () => {
    test.use({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 401.0.0.42.75 (iPhone15,3; iOS 18_6; pl_PL; pl; scale=3.00; 1290x2796; 798452231)',
    })

    test('Today says to open Teleo in Safari before anything is done there', async ({ page }, testInfo) => {
      await finishOnboarding(page, { keepInstallOffer: true })
      const sheet = page.getByRole('dialog', { name: 'Otwórz Teleo w przeglądarce' })
      await expect(sheet).toBeVisible()
      await expect(sheet.getByText(/wbudowana w aplikację Instagram/)).toBeVisible()
      await expect(sheet.getByRole('button', { name: 'Kopiuj link' })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('install-in-app.png'), animations: 'disabled' })
      await sheet.getByRole('button', { name: 'Nie teraz' }).click()
      await expect.poll(() => readInstallOffer(page)).toMatchObject({ dismissals: 1 })
    })
  })
})
