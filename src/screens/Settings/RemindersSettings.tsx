import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { buildCalendarIcs, type IcsEvent } from '@/domain/reminders/ics'
import { DEFAULT_REMINDER_TIMES, nextReminderAt, REMINDER_LIMITS, sortReminderTimes } from '@/domain/reminders/times'
import { dayKeyFor, dayKeyToLocalDate } from '@/domain/time/dayKey'
import { downloadText } from '@/lib/download'
import { newId } from '@/lib/id'
import { isIosDevice } from '@/lib/install'
import { appUrl, requestNotificationPermission } from '@/services/reminders'
import { updateAppSettings } from '@/services/settings'
import { taskViews } from '@/services/tasks'
import { useAppSettings } from '@/stores/settings'
import { toast } from '@/stores/ui'

/**
 * Settings → Reminders: the fixed hours, device notifications (honest about what each platform allows), and
 * the calendar file with every hour and every current task (DECISIONS #122).
 */
export function RemindersSettings() {
  const { t, i18n } = useTranslation()
  const { reminderTimes, notifications, dayStartHour } = useAppSettings()
  const ios = isIosDevice(navigator.userAgent, navigator.maxTouchPoints)

  const setTimes = (times: string[]) => void updateAppSettings({ reminderTimes: times })
  const changeTime = (index: number, value: string) => {
    // An empty value is a half-typed hour; a duplicate would collapse into the other slot.
    if (!value || reminderTimes.some((time, i) => i !== index && time === value)) return
    setTimes(reminderTimes.map((time, i) => (i === index ? value : time)))
  }
  const addTime = () => setTimes([...reminderTimes, DEFAULT_REMINDER_TIMES.find((time) => !reminderTimes.includes(time)) ?? '12:00'])
  const removeTime = (index: number) => setTimes(reminderTimes.filter((_, i) => i !== index))

  const toggleNotifications = async (on: boolean) => {
    if (!on) {
      await updateAppSettings({ notifications: false })
      return
    }
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      toast({ kind: 'error', title: t(permission === 'unsupported' ? 'settings.notificationsUnsupported' : 'settings.notificationsDenied') })
      return
    }
    await updateAppSettings({ notifications: true })
    const next = nextReminderAt(reminderTimes, new Date())
    const clock = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })
    toast({ kind: 'success', title: t('settings.notificationsOn', { time: next ? clock.format(next) : '' }) })
  }

  const calendar = async () => {
    const now = new Date()
    const today = dayKeyFor(now.getTime(), dayStartHour)
    const sorted = sortReminderTimes(reminderTimes)
    const [first = '07:00'] = sorted
    const date = (day: string) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(day))
    const events: IcsEvent[] = sorted.map((time) => ({
      uid: `teleo-daily-${newId()}@teleo`,
      title: t('settings.reminderTitle'),
      description: t('settings.reminderBody'),
      time,
      startDate: now,
    }))
    // Every task still running (or yet to start): a daily event at the first hour, up to its last day.
    for (const { task, text, progress } of await taskViews(now.getTime())) {
      if (!text || task.archived || progress.over) continue
      events.push({
        uid: `teleo-task-${task.id}@teleo`,
        title: t('settings.reminderTaskTitle', { title: text.title, count: task.timesPerDay }),
        description: t('settings.reminderTaskBody', { count: task.timesPerDay, date: date(task.endDay) }),
        time: first,
        startDate: dayKeyToLocalDate(task.startDay > today ? task.startDay : today),
        untilDate: dayKeyToLocalDate(task.endDay),
      })
    }
    downloadText('teleo-reminders.ics', buildCalendarIcs({ events, url: appUrl(), now }), 'text/calendar')
  }

  return (
    <>
      <div>
        <p className="font-medium">{t('settings.reminderTimes')}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{t('settings.reminderTimesHint')}</p>
        <ul className="mt-3 flex flex-wrap items-center gap-2">
          {reminderTimes.map((time, index) => (
            // Slots are positional: a key from the value would remount the input on every edit.
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className="flex items-center gap-1">
              <input
                type="time"
                aria-label={t('settings.reminderTimeLabel', { n: index + 1 })}
                value={time}
                onChange={(e) => changeTime(index, e.target.value)}
                className="h-10 rounded-full border border-line-strong bg-surface px-4 font-semibold"
              />
              {reminderTimes.length > REMINDER_LIMITS.min && <IconButton label={t('settings.reminderRemove', { n: index + 1 })} icon="x" className="size-8" onClick={() => removeTime(index)} />}
            </li>
          ))}
          {reminderTimes.length < REMINDER_LIMITS.max && (
            <li>
              <Button size="sm" variant="secondary" icon="plus" onClick={addTime}>
                {t('settings.reminderAdd')}
              </Button>
            </li>
          )}
        </ul>
      </div>

      <Switch checked={notifications} onChange={(on) => void toggleNotifications(on)} label={t('settings.notifications')} description={t('settings.notificationsHint')} />
      <p className="-mt-3 text-sm text-ink-soft">{ios ? t('settings.notificationsIos') : t('settings.notificationsAndroid')}</p>

      <p className="text-sm text-ink-soft">{t('settings.reminderHint')}</p>
      <Button variant="secondary" onClick={() => void calendar()} icon="calendar-plus">
        {t('settings.reminderDownload')}
      </Button>
    </>
  )
}
