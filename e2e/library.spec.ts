import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test.use({ locale: 'en-US' })

test('the library finds a prayer by need, and the filter survives opening it and coming back', async ({ page }) => {
  await installFakeSpeech(page)
  await finishOnboarding(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Library' }).click()

  await expect(page.getByRole('heading', { name: 'What do you pray for?' })).toBeVisible()
  await page.getByRole('group', { name: 'Area of life' }).getByRole('button', { name: /^Health & body/ }).click()
  await page.getByRole('group', { name: 'Need' }).getByRole('button', { name: /^Sleep & nightmares/ }).click()
  await expect(page).toHaveURL(/#\/library\?area=health&need=sleep$/)
  await expect(page.getByText('2 texts')).toBeVisible()

  // The text names what it is prayed for and whose words these are.
  await page.getByRole('link', { name: /Against Nightmares and Night Attacks/ }).click()
  await expect(page.getByRole('heading', { name: 'Prayed for' })).toBeVisible()
  await expect(page.getByText('Prophet Lovy L. Elias')).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(/#\/library\?area=health&need=sleep$/)
  await expect(page.getByRole('button', { name: /^Sleep & nightmares/ })).toHaveAttribute('aria-pressed', 'true')

  // A need on a text page is a link to the library filtered by it.
  await page.getByRole('link', { name: /Against Nightmares and Night Attacks/ }).click()
  await page.getByRole('link', { name: 'Spiritual warfare' }).click()
  await expect(page).toHaveURL(/#\/library\?need=warfare$/)
  await expect(page.getByRole('button', { name: /^Deliverance & protection/ })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL(/#\/library$/)
  await expect(page.getByRole('group', { name: 'Need' })).toHaveCount(0)
})
