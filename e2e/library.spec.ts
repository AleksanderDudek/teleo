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
  await expect(page.getByRole('status')).toHaveText('2 texts')

  // The text names what it is prayed for and whose words these are.
  await page.getByRole('link', { name: /Against Nightmares and Night Attacks/ }).click()
  await expect(page.getByRole('heading', { name: 'Prayed for' })).toBeVisible()
  await expect(page.getByText('Prophet Lovy L. Elias')).toBeVisible()
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(/#\/library\?area=health&need=sleep$/)
  await expect(page.getByRole('button', { name: /^Sleep & nightmares/ })).toHaveAttribute('aria-pressed', 'true')

  // A need on a text page is a link to the library filtered by it.
  await page.getByRole('link', { name: /Against Nightmares and Night Attacks/ }).click()
  await page.getByRole('link', { name: 'Spiritual warfare', exact: true }).click()
  await expect(page).toHaveURL(/#\/library\?need=warfare$/)
  await expect(page.getByRole('button', { name: /^Deliverance & protection/ })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page).toHaveURL(/#\/library$/)
  await expect(page.getByRole('group', { name: 'Need' })).toHaveCount(0)
})

test('search takes words in any order, puts the best match first, and a text page leads to more for its needs', async ({
  page,
}) => {
  await installFakeSpeech(page)
  await finishOnboarding(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Library' }).click()

  await page.getByRole('searchbox', { name: 'Search' }).fill('spouse spirit')
  await expect(page).toHaveURL(/#\/library\?q=spouse\+spirit$/)
  const cards = page.getByRole('main').getByRole('listitem')
  await expect(cards.first()).toContainText('Against Spirit Spouses Fighting My Marriage')
  await expect(cards.nth(1)).toContainText('Breaking Spirit Spouse Bondage')

  // A need's name is searchable too: nothing in this title says "nightmares".
  await page.getByRole('searchbox', { name: 'Search' }).fill('nightmares')
  await expect(page.getByRole('link', { name: /A Night Prayer/ })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search' }).fill('spouse spirit')
  await cards.first().getByRole('link').click()
  const related = page.getByRole('region', { name: 'More for this need' })
  await expect(related.getByRole('link', { name: /Breaking Spirit Spouse Bondage/ })).toBeVisible()
  await related.getByRole('link', { name: /Breaking Spirit Spouse Bondage/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Breaking Spirit Spouse Bondage' })).toBeVisible()
  // The way back still leads to the search the first text was found by.
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page).toHaveURL(/#\/library\?q=spouse\+spirit$/)
})

test('the text picker of a new session narrows the list by need', async ({ page }) => {
  await installFakeSpeech(page)
  await finishOnboarding(page)
  await page.goto('./#/sessions/new')
  await page.getByRole('button', { name: 'Add text' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'What it is for' }).selectOption({ label: 'Sleep & nightmares (2)' })
  await expect(dialog.getByRole('listitem')).toHaveCount(2)
  await dialog.getByRole('button', { name: /Against Nightmares and Night Attacks/ }).click()
  await expect(page.getByText('27 / 150 sentences')).toBeVisible()
})
