import { expect, test } from '@playwright/test'
import { finishOnboarding } from './fakeSpeech.ts'

/** A friend's card, as a challenge link carries it (base64url JSON). */
function friendCode(name: string, points: number): string {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const card = { v: 1, id: 'friend01', name, character: 'david', at: now.getTime(), streak: 3, day: { k: day, p: points }, week: { k: '2020-01-06', p: 1 }, month: { k: day.slice(0, 7), p: points } }
  return Buffer.from(JSON.stringify(card)).toString('base64url')
}

test('a friend’s card from a link joins the leaderboard', async ({ page }) => {
  await finishOnboarding(page)
  await page.goto(`./#/friend?c=${friendCode('Dawid', 420)}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dawid')
  await page.getByRole('button', { name: /Dodaj do mojej tablicy|Add to my leaderboard/ }).click()
  await expect(page).toHaveURL(/#\/progress$/)
  const board = page.getByRole('region', { name: /Tablica punktów|Leaderboard/ })
  await board.getByText(/^(Dzień|Day)$/).click()
  await expect(board.getByRole('listitem').filter({ hasText: 'Dawid' }).getByText(/420/)).toBeVisible()
  await board.getByRole('button', { name: /Usuń: Dawid|Remove Dawid/ }).click()
  await expect(board.getByText('Dawid')).toHaveCount(0)
})

test('a malformed friend link is refused, even before onboarding', async ({ page }) => {
  await page.goto('./#/friend?c=not-a-card')
  await expect(page.getByText(/nie zawiera poprawnej karty|doesn't hold a valid card/)).toBeVisible()
})
