/// <reference lib="webworker" />
/**
 * Teleo's service worker (vite-plugin-pwa `injectManifest`): the offline shell — precache, navigation fallback,
 * the Whisper runtime and Bible caches — and the reminder the page cannot give while closed (DECISIONS #122):
 * on Chrome Android with the app installed, a periodic background sync reads the database and shows one
 * notification a day once a reminder hour has passed. The database is opened without a declared schema (Dexie's
 * dynamic mode), so the worker never upgrades it; the day last notified lives in Cache Storage, not in the database.
 */
import Dexie from 'dexie'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { appSettingsFrom } from '@/db/defaults'
import { DB_NAME } from '@/db/name'
import { PERIODIC_SYNC_TAG, REMINDER_TAG, reminderNudge, reminderStateFrom, type ReminderRows } from '@/domain/reminders/nudge'
import { clockDayOf, passedReminderToday } from '@/domain/reminders/times'
import { ORT_CACHE } from '@/domain/speech/whisper/runtime'
import { dayKeyFor } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> }

/** `/teleo/` — the worker sits at the app's root. */
const BASE = new URL('./', self.location.href).pathname

// --- Offline shell -----------------------------------------------------------

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every in-app route is the shell; the privacy page is a real file of its own.
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${BASE}index.html`), { denylist: [/privacy\.html$/] }))

const under = (folder: string) => ({ url }: { url: URL }) => url.origin === self.location.origin && url.pathname.startsWith(`${BASE}${folder}/`)

// Versioned paths (ort/<version>/…) make cache-first safe. The model download also stores the runtime in this
// cache, so Whisper works offline after the first use.
registerRoute(under('ort'), new CacheFirst({ cacheName: ORT_CACHE, plugins: [new CacheableResponsePlugin({ statuses: [200] })] }))
// Bible texts (≈ 9 MB in all) are fetched book by book when read and kept for offline use; never precached.
// Stale-while-revalidate picks up a regenerated file on a later visit.
registerRoute(under('bible'), new StaleWhileRevalidate({ cacheName: 'teleo-bible', plugins: [new CacheableResponsePlugin({ statuses: [200] })] }))

// Updates are never applied on their own (DECISIONS #8): the page asks once the user agrees to reload.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: unknown } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})

// --- Reminders ----------------------------------------------------------------

const REMINDER_CACHE = 'teleo-reminders'
const LAST_NOTIFIED_URL = `${BASE}__reminders/last-notified-day`

async function lastNotifiedDay(): Promise<string | null> {
  const cache = await caches.open(REMINDER_CACHE)
  const hit = await cache.match(LAST_NOTIFIED_URL)
  return hit ? hit.text() : null
}

async function rememberNotifiedDay(day: DayKey): Promise<void> {
  const cache = await caches.open(REMINDER_CACHE)
  await cache.put(LAST_NOTIFIED_URL, new Response(day))
}

interface AppRow {
  key: string
  value: Parameters<typeof appSettingsFrom>[0]
}

/** What the reminder needs, read as the database is; null when the app never ran here. */
async function readReminderRows(now: number): Promise<(ReminderRows & { notifications: boolean; reminderTimes: readonly string[] }) | null> {
  const dexie = new Dexie(DB_NAME)
  try {
    await dexie.open()
  } catch {
    return null
  }
  try {
    const row = (await dexie.table('settings').get('app')) as AppRow | undefined
    if (!row) return null
    const app = appSettingsFrom(row.value)
    const today = dayKeyFor(now, app.dayStartHour)
    const has = (table: string) => dexie.tables.some((t) => t.name === table)
    const [stats, tasks, logs] = await Promise.all([
      dexie.table('dailyStats').get(today) as Promise<{ segmentsAccepted?: number } | undefined>,
      has('tasks') ? (dexie.table('tasks').toArray() as Promise<ReminderRows['tasks']>) : [],
      has('taskLog') ? (dexie.table('taskLog').where('dayKey').equals(today).toArray() as Promise<ReminderRows['logs']>) : [],
    ])
    return { lang: app.uiLang, today, segmentsAccepted: stats?.segmentsAccepted ?? 0, tasks, logs, notifications: app.notifications, reminderTimes: app.reminderTimes }
  } finally {
    dexie.close()
  }
}

/** One notification a day, once a reminder hour has passed — and only while there is something to say. */
async function checkReminders(now = Date.now()): Promise<void> {
  const rows = await readReminderRows(now)
  if (!rows?.notifications) return
  const date = new Date(now)
  if (!passedReminderToday(rows.reminderTimes, date)) return
  const day = clockDayOf(date)
  if ((await lastNotifiedDay()) === day) return
  const nudge = reminderNudge(reminderStateFrom(rows))
  if (!nudge) return
  await self.registration.showNotification(nudge.title, { body: nudge.body, tag: REMINDER_TAG, icon: `${BASE}icons/pwa-192x192.png`, data: { url: BASE } })
  await rememberNotifiedDay(day)
}

interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string
}

self.addEventListener('periodicsync', (event) => {
  const sync = event as PeriodicSyncEvent
  if (sync.tag === PERIODIC_SYNC_TAG) sync.waitUntil(checkReminders())
})

// A tapped reminder brings the open app forward, or opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: unknown } | undefined
  const target = new URL(typeof data?.url === 'string' ? data.url : BASE, self.location.origin).href
  const root = new URL(BASE, self.location.origin).href
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = clients.find((client) => client.url.startsWith(root))
      if (open) await open.focus()
      else await self.clients.openWindow(target)
    })(),
  )
})
