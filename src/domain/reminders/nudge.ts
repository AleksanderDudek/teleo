import { isTaskActiveOn, taskProgress, type TaskLike } from '@/domain/tasks'
import type { DayKey, Lang } from '@/domain/types'

/** One reminder notification at a time: a newer one replaces the one still showing. */
export const REMINDER_TAG = 'teleo-reminder'
/** The periodic background sync the service worker answers (Chrome Android, app installed). */
export const PERIODIC_SYNC_TAG = 'teleo-reminders'

/** What a reminder has to go on. */
export interface ReminderState {
  lang: Lang
  /** Something was accepted today (the day as the app counts it). */
  saidToday: boolean
  /** Task repetitions still due today. */
  tasksRemaining: number
}

export interface Nudge {
  title: string
  body: string
}

/**
 * Notification copy lives here, not in the i18n files: the service worker shows reminders too and must not
 * carry i18next and both translation files (same exception as the fatal-error message in `main.tsx`).
 */
const COPY: Record<Lang, { title: string; tasks: (n: number) => string; nothingSaid: string }> = {
  pl: {
    title: 'Czas na Teleo',
    tasks: (n) => `Do powiedzenia dziś: ${n} ${pluralPl(n, 'powtórzenie', 'powtórzenia', 'powtórzeń')} zadań.`,
    nothingSaid: 'Wypowiedz dziś choć jedno zdanie na głos.',
  },
  en: {
    title: 'Time for Teleo',
    tasks: (n) => `${n} task ${n === 1 ? 'repetition' : 'repetitions'} left today.`,
    nothingSaid: 'Say at least one sentence aloud today.',
  },
}

function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const tens = n % 100
  if (n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14)) return few
  return many
}

/** What a reminder says — or null when there is nothing left to remind of (said today, no tasks due). */
export function reminderNudge(state: ReminderState): Nudge | null {
  const copy = COPY[state.lang]
  if (state.tasksRemaining > 0) return { title: copy.title, body: copy.tasks(state.tasksRemaining) }
  if (!state.saidToday) return { title: copy.title, body: copy.nothingSaid }
  return null
}

export interface ReminderRows {
  lang: Lang
  /** The app's day `now` belongs to (`dayKeyFor(now, dayStartHour)`). */
  today: DayKey
  /** Accepted segments on `today` (0 without a stats row). */
  segmentsAccepted: number
  tasks: ReadonlyArray<TaskLike & { id: string }>
  logs: ReadonlyArray<{ taskId: string; dayKey: DayKey }>
}

/** The reminder state from raw rows (the page reads them through Dexie, the service worker through plain tables). */
export function reminderStateFrom(rows: ReminderRows): ReminderState {
  let tasksRemaining = 0
  for (const task of rows.tasks) {
    if (!isTaskActiveOn(task, rows.today)) continue
    const logDays = rows.logs.filter((log) => log.taskId === task.id).map((log) => log.dayKey)
    tasksRemaining += taskProgress(task, logDays, rows.today).remainingToday
  }
  return { lang: rows.lang, saidToday: rows.segmentsAccepted > 0, tasksRemaining }
}
