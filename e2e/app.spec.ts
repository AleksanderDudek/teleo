import { expect, test } from '@playwright/test'
import { declineTour, finishOnboarding, installFakeSpeech, libraryReady } from './fakeSpeech.ts'

test.describe('onboarding', () => {
  test.use({ locale: 'en-US' })

  test('the browser language + a character + affirmations + goal 20 shape the library, the avatar and the Start button', async ({ page }) => {
    // Playwright's headless shell has no speech service and crashes on SpeechRecognition.available().
    await installFakeSpeech(page)
    await page.goto('./')
    // The language comes from the browser and can be changed right on the welcome step.
    await expect(page.getByRole('heading', { name: 'Speak it. Complete it.' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'English' })).toBeChecked()
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByText('Michał', { exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Michał' })).toBeChecked()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('radio', { name: /^Affirmations/ }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Let’s test the microphone' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: '20 sentences' }).click()
    await page.getByRole('button', { name: 'Begin' }).click()

    await expect(page).toHaveURL(/#\/$/)
    await libraryReady(page)
    await declineTour(page)
    await expect(page.getByRole('link', { name: 'Your character: Michał' })).toBeVisible()
    await expect(page.getByText('Morning affirmations · 10 sentences')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Today’s goal' })).toHaveAttribute('aria-valuemax', '20')
    await page.getByRole('navigation').getByRole('link', { name: 'Library' }).click()
    await expect(page.getByRole('link', { name: /Morning/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ojcze nasz/ })).toHaveCount(0)
  })
})

test.describe('data', () => {
  test.use({ locale: 'pl-PL', acceptDownloads: true })

  test('the installed app shell opens offline and explains that speech needs the internet', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit cannot reload through a service worker while emulating offline')
    await installFakeSpeech(page)
    await finishOnboarding(page)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload() // now controlled by the service worker
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Rozpocznij', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click()
    await expect(page.getByText(/Jesteś offline/)).toBeVisible()
    await context.setOffline(false)
  })

  test('privacy policy is reachable from settings', async ({ page }) => {
    await finishOnboarding(page)
    await page.goto('./#/settings')
    const [policy] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Polityka prywatności' }).click()])
    await expect(policy.getByRole('heading', { name: 'Teleo – modlitwy i afirmacje' })).toBeVisible()
  })
})

test.describe('session builder', () => {
  test.use({ locale: 'pl-PL' })

  test('a new session with a repeated text shows the counter and plays with a repetition badge', async ({ page }) => {
    await installFakeSpeech(page)
    await finishOnboarding(page)
    await page.getByRole('navigation').getByRole('link', { name: 'Sesje' }).click()
    await page.getByRole('link', { name: 'Nowa sesja' }).click()
    await page.getByPlaceholder('np. Modlitwa wieczorna').fill('Wieczorna chwała')
    await page.getByRole('button', { name: 'Dodaj tekst' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Chwała Ojcu/ }).click()
    const repeat = page.getByRole('group', { name: 'Powtórzenia' })
    await repeat.getByRole('button', { name: 'Powtórzenia: +1' }).click()
    await repeat.getByRole('button', { name: 'Powtórzenia: +1' }).click()
    await expect(page.getByText('6 / 150 zdań')).toBeVisible()
    await page.getByRole('button', { name: 'Zapisz sesję' }).click()
    await expect(page).toHaveURL(/#\/sessions$/)
    const card = page.locator('.card', { hasText: 'Wieczorna chwała' })
    await expect(card).toContainText('6 zdań')
    await card.getByRole('button', { name: 'Rozpocznij' }).click()
    await expect(page.getByText('Chwała Ojcu · 1/3')).toBeVisible()
  })
})

test.describe('browser without Web Speech', () => {
  test.use({ locale: 'pl-PL' })

  test('Firefox explains the missing recogniser and points to the offline engine', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'only Firefox ships without SpeechRecognition')
    await finishOnboarding(page) // no fake: the real browser API is used
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click()
    await expect(page.getByText(/Ta przeglądarka nie rozpoznaje mowy/)).toBeVisible()
    await page.getByRole('link', { name: /Ustawienia|Whisper/ }).first().click()
    await expect(page).toHaveURL(/#\/settings\?section=speech/)
  })
})

test.describe('one language at a time', () => {
  test.use({ locale: 'pl-PL' })

  test('Polish shows only Polish prayers; switching to English shows only English ones', async ({ page }) => {
    await finishOnboarding(page)
    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    await expect(page.getByRole('link', { name: /Ojcze nasz/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Lord’s Prayer|Hail Mary/ })).toHaveCount(0)
    await page.getByRole('navigation').getByRole('link', { name: 'Sesje' }).click()
    await expect(page.getByRole('heading', { name: 'Dziesiątka różańca' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Decade of the Rosary|Morning affirmations/ })).toHaveCount(0)

    await page.getByRole('navigation').getByRole('link', { name: 'Ustawienia' }).click()
    await page.getByText('English', { exact: true }).click()
    await page.getByRole('navigation').getByRole('link', { name: 'Library' }).click()
    await expect(page.getByRole('link', { name: /Lord’s Prayer/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ojcze nasz/ })).toHaveCount(0)
    await page.getByRole('navigation').getByRole('link', { name: 'Today' }).click()
    await expect(page.getByText(/Morning affirmations · 10 sentences/)).toBeVisible()
  })
})
