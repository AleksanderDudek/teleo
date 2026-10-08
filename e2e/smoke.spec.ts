import { expect, test } from '@playwright/test'
import { finishOnboarding } from './fakeSpeech.ts'

test('first launch shows onboarding, then the five tabs navigate', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await finishOnboarding(page)

  const nav = page.getByRole('navigation')
  for (const name of [/Biblioteka|Library/, /Sesje|Sessions/, /Postępy|Progress/, /Ustawienia|Settings/, /Dziś|Today/]) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('interface language can be switched in settings', async ({ page }) => {
  await finishOnboarding(page)
  await page.goto('./#/settings')
  await page.getByText('English', { exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByText('Polski', { exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ustawienia')
})

test('no screen is wider than the phone it is on', async ({ page }) => {
  await finishOnboarding(page)
  for (const route of ['', 'library', 'library/new', 'sessions', 'sessions/new', 'tasks', 'progress', 'progress/history', 'bible', 'settings', 'settings/data']) {
    await page.goto(`./#/${route}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const [scrollWidth, innerWidth] = await page.evaluate(() => [document.scrollingElement?.scrollWidth ?? 0, window.innerWidth])
    expect(scrollWidth, `/${route} scrolls sideways`).toBeLessThanOrEqual(innerWidth)
  }
})

test.describe('first start in the other language', () => {
  test.use({ locale: 'en-US' })

  test('the welcome step lets a Polish speaker with an English phone switch at once', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Speak it. Complete it.' })).toBeVisible()
    await page.getByText('Polski', { exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wypowiedz. Wypełnij.')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  })
})
