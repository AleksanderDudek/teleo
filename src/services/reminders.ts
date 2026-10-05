import { db } from '@/db/schema'
import { PERIODIC_SYNC_TAG, REMINDER_TAG, reminderNudge, reminderStateFrom, type Nudge } from '@/domain/reminders/nudge'
import { dayKeyFor } from '@/domain/time/dayKey'
import { readSettings } from './settings'

/** The browser's answer, or that it has no notifications at all (no `Notification`, no service worker). */
export type NotificationSupport = 'unsupported' | NotificationPermission

export function notificationSupport(): NotificationSupport {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported'
  return Notification.requestPermission()
}

/** What a reminder would say right now, from the database (null: nothing left to remind of). */
export async function reminderNudgeNow(now = Date.now()): Promise<Nudge | null> {
  const { app } = await readSettings()
  const today = dayKeyFor(now, app.dayStartHour)
  const [stats, tasks, logs] = await Promise.all([db.dailyStats.get(today), db.tasks.toArray(), db.taskLog.where('dayKey').equals(today).toArray()])
  return reminderNudge(reminderStateFrom({ lang: app.uiLang, today, segmentsAccepted: stats?.segmentsAccepted ?? 0, tasks, logs }))
}

/** The app's root, which a tapped notification opens. */
export const appUrl = (): string => new URL(import.meta.env.BASE_URL, location.origin).href

/** Shows the reminder due now; false when notifications are off, not allowed, or there is nothing to say. */
export async function showReminder(now = Date.now()): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false
  if (!(await readSettings()).app.notifications) return false
  const nudge = await reminderNudgeNow(now)
  if (!nudge) return false
  const options: NotificationOptions = { body: nudge.body, tag: REMINDER_TAG, icon: `${import.meta.env.BASE_URL}icons/pwa-192x192.png`, data: { url: appUrl() } }
  // Through the service worker where there is one (the installed app); a plain notification in dev.
  const registration = await navigator.serviceWorker.getRegistration()
  if (registration) await registration.showNotification(nudge.title, options)
  else new Notification(nudge.title, options)
  return true
}

/** The number on the installed app's icon; cleared at zero. A nicety: platforms without it are simply skipped. */
export async function syncAppBadge(count: number): Promise<void> {
  if (!('setAppBadge' in navigator)) return
  try {
    if (count > 0) await navigator.setAppBadge(count)
    else await navigator.clearAppBadge()
  } catch {
    // Not installed, or the platform refuses: nothing to show.
  }
}

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>
  unregister(tag: string): Promise<void>
}

export type PeriodicSyncState = 'registered' | 'unregistered' | 'unavailable'

/** Twice a day at most; Chrome spaces the checks out further on its own. */
const PERIODIC_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000

/**
 * Registers (or drops) the service worker's background reminder check — Chrome on Android with the app installed;
 * 'unavailable' everywhere else, where the calendar and the in-app reminders are all there is.
 */
export async function syncPeriodicReminders(enabled: boolean): Promise<PeriodicSyncState> {
  if (!('serviceWorker' in navigator)) return 'unavailable'
  const registration = (await navigator.serviceWorker.getRegistration()) as (ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager }) | undefined
  const periodicSync = registration?.periodicSync
  if (!periodicSync) return 'unavailable'
  try {
    if (!enabled) {
      await periodicSync.unregister(PERIODIC_SYNC_TAG)
      return 'unregistered'
    }
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (status.state !== 'granted') return 'unavailable'
    await periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: PERIODIC_SYNC_INTERVAL_MS })
    return 'registered'
  } catch {
    return 'unavailable'
  }
}
