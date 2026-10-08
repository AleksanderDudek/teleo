import { expect, test, type Page } from '@playwright/test'
import { installFakeSpeech, libraryReady } from './fakeSpeech.ts'

test.use({ locale: 'en-US' })

const panel = (page: Page) => page.getByRole('dialog', { name: /.+/ }).filter({ has: page.locator('#tour-step-title') })
/** The tour version this install has taken, as stored (`meta.tourVersion`). */
const seenTour = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('teleo')
        open.onsuccess = () => {
          const get = open.result.transaction('settings').objectStore('settings').get('meta')
          get.onsuccess = () => {
            resolve((get.result as { value?: { tourVersion?: number } } | undefined)?.value?.tourVersion ?? 0)
            open.result.close()
          }
        }
      }),
  )

const expectStep = async (page: Page, title: string, url: RegExp) => {
  await expect(panel(page).getByRole('heading', { name: title })).toBeVisible()
  await expect(page).toHaveURL(url)
}

test('after the setup Today offers a guided tour that walks the app and is not offered again', async ({ page }) => {
  await installFakeSpeech(page)
  await page.goto('./')
  await page.getByRole('button', { name: 'Skip' }).click()
  await libraryReady(page)

  const invite = page.getByRole('dialog', { name: 'Shall I show you around?' })
  await expect(invite).toBeVisible()
  await invite.getByRole('button', { name: 'Show me' }).click()

  await expect(panel(page).getByText('Step 1 of 10')).toBeVisible()
  await expectStep(page, 'Start here', /#\/$/)
  const next = () => panel(page).getByRole('button', { name: 'Next' }).click()
  await next()
  await expectStep(page, 'Your day at a glance', /#\/$/)
  await next()
  await expectStep(page, 'What do you pray for?', /#\/library\?area=emotions&need=peace$/)
  await next()
  await expectStep(page, 'Prayers for that need', /need=peace$/)
  await next()
  await expectStep(page, 'Say it now', /#\/library\/builtin%3Aen\./)
  await next()
  await expectStep(page, 'From memory', /#\/library\/builtin/)
  await next()
  await expectStep(page, 'A daily task', /#\/library\/builtin/)
  await next()
  await expectStep(page, 'Sessions', /#\/sessions$/)
  await next()
  await expectStep(page, 'Progress', /#\/progress$/)
  await next()
  await expectStep(page, 'You are ready', /#\/$/)
  await panel(page).getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('.tour-hole')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => seenTour(page)).toBe(1)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Settings can show it again; Escape ends it at any step.
  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Show me around' }).click()
  await expectStep(page, 'Start here', /#\/$/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.tour-hole')).toHaveCount(0)
})
