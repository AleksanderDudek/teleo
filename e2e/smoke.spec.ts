import { expect, test } from '@playwright/test'

test('first launch shows onboarding, then the five tabs navigate', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await page.getByRole('button', { name: /Zaczynamy|Get started/ }).click()
  await expect(page).toHaveURL(/#\/$/)

  const nav = page.getByRole('navigation')
  for (const name of [/Biblioteka|Library/, /Sesje|Sessions/, /Postępy|Progress/, /Ustawienia|Settings/, /Dziś|Today/]) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('interface language can be switched in settings', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /Zaczynamy|Get started/ }).click()
  await page.goto('./#/settings')
  await page.getByText('English', { exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByText('Polski', { exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ustawienia')
})
