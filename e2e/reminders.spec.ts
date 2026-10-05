import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { finishOnboarding, installFakeSpeech } from './fakeSpeech.ts'

test.use({ locale: 'pl-PL', acceptDownloads: true })

test('the reminder hours and the current tasks go to the calendar as one .ics file', async ({ page }) => {
  await installFakeSpeech(page)
  await finishOnboarding(page)

  // A task for a week, three times a day (the defaults).
  await page.goto('./#/tasks/new?text=builtin%3Apl.chwala-ojcu')
  await page.getByRole('button', { name: '7 dni' }).click()
  await page.getByRole('button', { name: 'Zapisz zadanie' }).click()
  await expect(page).toHaveURL(/#\/$/)

  await page.goto('./#/settings?section=reminders')
  const section = page.getByRole('region', { name: 'Przypomnienia' })
  // Three fixed hours by default; one can go, one can come back, and each can change.
  await expect(section.getByRole('textbox', { name: /^Przypomnienie \d$/ })).toHaveCount(3)
  await section.getByRole('button', { name: 'Usuń przypomnienie 3' }).click()
  await expect(section.getByRole('textbox', { name: /^Przypomnienie \d$/ })).toHaveCount(2)
  await section.getByRole('button', { name: 'Dodaj godzinę' }).click()
  await expect(section.getByRole('textbox', { name: 'Przypomnienie 3' })).toHaveValue('21:00')
  await section.getByRole('textbox', { name: 'Przypomnienie 1' }).fill('06:30')
  await expect(section.getByRole('textbox', { name: 'Przypomnienie 1' })).toHaveValue('06:30')
  await expect(section.getByRole('button', { name: 'Dodaj godzinę' })).toHaveCount(0)

  const [download] = await Promise.all([page.waitForEvent('download'), section.getByRole('button', { name: 'Dodaj do kalendarza (.ics)' }).click()])
  expect(download.suggestedFilename()).toBe('teleo-reminders.ics')
  const ics = await readFile(await download.path(), 'utf8')
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4)
  expect(ics).toMatch(/DTSTART:\d{8}T063000\r\nDURATION:PT10M\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Czas na Teleo\r\n/)
  expect(ics).toMatch(/RRULE:FREQ=DAILY;UNTIL=\d{8}T235959\r\nSUMMARY:Teleo: Chwała Ojcu · 3×\r\n/)
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)

  // The hours survive a reload (they are settings, not form state).
  await page.reload()
  await expect(page.getByRole('region', { name: 'Przypomnienia' }).getByRole('textbox', { name: 'Przypomnienie 1' })).toHaveValue('06:30')
})

test('device notifications switch on once the browser allows them', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Granting the notification permission is a Chromium feature of Playwright')
  await context.grantPermissions(['notifications'])
  await installFakeSpeech(page)
  await finishOnboarding(page)
  await page.goto('./#/settings?section=reminders')
  const toggle = page.getByRole('switch', { name: 'Powiadomienia na tym urządzeniu' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText(/Powiadomienia włączone – następne o \d{2}:\d{2}\./)).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Powiadomienia na tym urządzeniu' })).toHaveAttribute('aria-checked', 'true')
})
