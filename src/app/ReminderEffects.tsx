import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { nextReminderAt } from '@/domain/reminders/times'
import { notificationSupport, showReminder, syncAppBadge, syncPeriodicReminders } from '@/services/reminders'
import { repetitionsDueToday } from '@/services/tasks'
import { useAppSettings } from '@/stores/settings'

/**
 * Reminders while the app is open (DECISIONS #122): the icon badge counts the task repetitions left today, a
 * notification shows at each reminder hour, and the background check is registered where the platform has one.
 */
export function ReminderEffects() {
  const { notifications, reminderTimes, dayStartHour } = useAppSettings()
  const due = useLiveQuery(() => repetitionsDueToday(), [dayStartHour])

  useEffect(() => {
    void syncAppBadge(notifications ? (due ?? 0) : 0)
  }, [due, notifications])

  useEffect(() => {
    void syncPeriodicReminders(notifications)
  }, [notifications])

  useEffect(() => {
    if (!notifications || notificationSupport() !== 'granted') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      const next = nextReminderAt(reminderTimes, new Date())
      if (!next) return
      timer = setTimeout(() => void showReminder().finally(schedule), next.getTime() - Date.now())
    }
    schedule()
    return () => clearTimeout(timer)
  }, [notifications, reminderTimes])

  return null
}
