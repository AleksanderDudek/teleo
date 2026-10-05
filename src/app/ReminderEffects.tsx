import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { nextReminderAt } from '@/domain/reminders/times'
import { notificationSupport, showReminder, syncAppBadge, syncPeriodicReminders } from '@/services/reminders'
import { repetitionsDueToday } from '@/services/tasks'
import { useAppSettings } from '@/stores/settings'

/** A timer that wakes this late (a frozen tab, a laptop asleep) has missed its hour: the next one will do. */
const LATE_MS = 5 * 60_000

/**
 * Reminders while the app is open (DECISIONS #122): the icon badge counts the task repetitions left today, a
 * notification shows at each reminder hour, and the background check is registered where the platform has one.
 */
export function ReminderEffects() {
  const { notifications, reminderTimes, dayStartHour } = useAppSettings()
  const granted = notifications && notificationSupport() === 'granted'
  // The settings row is re-read as an object on every write; the hours themselves change rarely.
  const hours = reminderTimes.join(',')
  const due = useLiveQuery(() => repetitionsDueToday(), [dayStartHour])

  useEffect(() => {
    void syncAppBadge(granted ? (due ?? 0) : 0)
  }, [due, granted])

  useEffect(() => {
    void syncPeriodicReminders(granted)
  }, [granted])

  useEffect(() => {
    if (!granted) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (cancelled) return
      const next = nextReminderAt(hours.split(','), new Date())
      if (!next) return
      timer = setTimeout(() => {
        const late = Date.now() - next.getTime() > LATE_MS
        const shown = late ? Promise.resolve(false) : showReminder()
        void shown.catch((error: unknown) => console.warn('[teleo] reminder failed', error)).finally(schedule)
      }, next.getTime() - Date.now())
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [granted, hours])

  return null
}
