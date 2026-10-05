import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test.use({ locale: 'pl-PL' })

test('an affirmation becomes a daily task: set up from the library, said from Today, counted on the summary', async ({ page }) => {
  test.setTimeout(120_000)
  await installFakeSpeech(page, { live: true, wordDelayMs: 10 })
  await finishOnboarding(page)

  // Set the task up from the text's page: twice a day for a week.
  await page.getByRole('navigation').getByRole('link', { name: 'Biblioteka' }).click()
  await page.getByRole('link', { name: /Chwała Ojcu/ }).click()
  await page.getByRole('link', { name: 'Ustaw jako codzienne zadanie' }).click()
  await expect(page).toHaveURL(/#\/tasks\/new\?text=/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chwała Ojcu')
  await page.getByRole('group', { name: 'Razy dziennie' }).getByRole('button', { name: 'Razy dziennie: −1' }).click()
  await page.getByRole('button', { name: '7 dni' }).click()
  await expect(page.getByText(/2 razy dziennie, od .* – łącznie 14 powtórzeń\./)).toBeVisible()
  await page.getByRole('button', { name: 'Zapisz zadanie' }).click()

  // Today lists it with nothing said yet; "Say it" starts a run of both repetitions.
  await expect(page).toHaveURL(/#\/$/)
  const task = page.getByRole('region', { name: 'Zadania na dziś' }).locator('.card', { hasText: 'Chwała Ojcu' })
  await expect(task).toContainText('2 razy dziennie · dzień 1 z 7')
  await expect(task.getByRole('img', { name: 'dziś 0/2' })).toBeVisible()
  await task.getByRole('button', { name: 'Powiedz: Chwała Ojcu' }).click()
  await expect(page).toHaveURL(/#\/play\//)
  await expect(page.getByText('Chwała Ojcu · 1/2')).toBeVisible()
  await page.getByRole('button', { name: 'Mów' }).click()
  await page.getByRole('button', { name: 'Rozumiem – dalej' }).click()
  await page.waitForURL(/summary$/, { timeout: 90_000 })
  await expect(page.getByText('Dziś 2/2 · dzień 1 z 7')).toBeVisible()

  // Back on Today the task is done for the day; the tasks screen shows the same.
  await page.getByRole('link', { name: 'Wróć do ekranu Dziś' }).click()
  await expect(task).toContainText('Dziś zrobione')
  await page.getByRole('navigation').getByRole('link', { name: 'Sesje' }).click()
  await expect(page.getByRole('link', { name: /Codzienne zadania/ })).toContainText('1 zadanie na dziś · do powiedzenia: 0')
  await page.getByRole('link', { name: /Codzienne zadania/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Codzienne zadania')
  await expect(page.locator('.card', { hasText: 'Chwała Ojcu' })).toContainText('łącznie 2/14')

  // The history logs the session: its text links to the library, its task badge to the tasks.
  await page.getByRole('navigation').getByRole('link', { name: 'Postępy' }).click()
  await page.getByRole('link', { name: /Historia sesji/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historia sesji')
  const row = page.locator('li.card', { hasText: 'Chwała Ojcu' }).first()
  await expect(row).toContainText('4/4')
  await expect(row).toContainText('ukończona')
  await expect(row.getByRole('link', { name: 'Zadanie: Chwała Ojcu' })).toBeVisible()
  await row.getByRole('link', { name: 'Chwała Ojcu', exact: true }).last().click()
  await expect(page).toHaveURL(/#\/library\/builtin%3Apl\.chwala-ojcu$/)
})
