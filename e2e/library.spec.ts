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

  // The text names what it is prayed for.
  await page.getByRole('link', { name: /Against Nightmares and Night Attacks/ }).click()
  await expect(page.getByRole('heading', { name: 'Prayed for' })).toBeVisible()
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

test('a stronghold is found by its name, and its page says what to read before praying (DECISIONS #132)', async ({ page }) => {
  await installFakeSpeech(page)
  await finishOnboarding(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Library' }).click()
  await page.getByRole('searchbox', { name: 'Search' }).fill('paranoia')
  await expect(page.getByRole('main').getByRole('listitem').first()).toContainText('Against the Stronghold of Paranoia')

  await page.getByRole('link', { name: /Against the Stronghold of Paranoia/ }).click()
  const note = page.getByRole('region', { name: 'Before you pray' })
  await expect(note).toContainText('Proverbs 18:11')
  await expect(note).toContainText('Start with “Tearing Down a Stronghold”')
  await expect(page.getByRole('link', { name: 'Strongholds & bad patterns', exact: true })).toBeVisible()
  // The note is read, never said: the sentences start with the prayer itself.
  const text = page.getByRole('region', { name: 'Text', exact: true })
  await expect(text.getByRole('listitem').first()).toContainText('Dear Father, thank You that these words could be spoken to me.')
  await expect(text).not.toContainText('Proverbs')
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

test.describe('in Polish', () => {
  test.use({ locale: 'pl-PL' })

  test('search finds other forms of a word typed without diacritics, need names, and leads to more for the need', async ({
    page,
  }) => {
    await installFakeSpeech(page)
    await finishOnboarding(page)
    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    const search = page.getByRole('searchbox', { name: 'Szukaj' })
    const cards = page.getByRole('main').getByRole('listitem')

    // "dlugi" (no ł, another form) still finds the prayer about debts, first.
    await search.fill('dlugi')
    await expect(cards.first()).toContainText('O uwolnienie od długów')

    // A need's name is searchable too: the title of the evening prayer says nothing of nightmares.
    await search.fill('koszmary')
    await expect(page.getByRole('link', { name: /Modlitwa wieczorna/ })).toBeVisible()

    // Words in any order and in other forms: both spirit-spouse prayers come first.
    await search.fill('małżonek duchowy')
    const spiritSpouse = /Przeciw duchowym małżonkom atakującym moje małżeństwo|Wyzwolenie z niewoli duchowego małżonka/
    await expect(cards.nth(0)).toContainText(spiritSpouse)
    await expect(cards.nth(1)).toContainText(spiritSpouse)
    const listUrl = page.url()

    await page.getByRole('link', { name: /Przeciw duchowym małżonkom atakującym moje małżeństwo/ }).click()
    const related = page.getByRole('region', { name: 'Więcej w tej intencji' })
    await related.getByRole('link', { name: /Wyzwolenie z niewoli duchowego małżonka/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Wyzwolenie z niewoli duchowego małżonka' })).toBeVisible()
    await page.getByRole('link', { name: 'Wstecz' }).click()
    await expect(page).toHaveURL(listUrl)
  })

  test('finds a stronghold by another form of its name and shows the note in Polish', async ({ page }) => {
    await installFakeSpeech(page)
    await finishOnboarding(page)
    await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
    await page.getByRole('searchbox', { name: 'Szukaj' }).fill('paranoja')
    await page.getByRole('link', { name: /Przeciw warowni paranoi/ }).click()
    const note = page.getByRole('region', { name: 'Zanim zaczniesz' })
    await expect(note).toContainText('Prz 18,11')
    await expect(note).toContainText('Zacznij od modlitwy „Burzenie warowni”')
    await expect(page.getByRole('link', { name: 'Warownie i złe wzorce', exact: true })).toBeVisible()
  })
})
