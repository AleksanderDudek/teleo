import { DEFAULT_REMINDER_TIMES, normalizeReminderTimes } from '@/domain/reminders/times'
import type { AppSettings, GameState } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  uiLang: 'pl',
  theme: 'system',
  engine: 'auto',
  whisperModel: 'base',
  dayStartHour: 3,
  dailyGoal: 10,
  handsFree: true,
  saveTranscripts: true,
  fontSize: 'md',
  listenFirst: false,
  grammaticalForm: 'n',
  contentFocus: 'both',
  reminderTimes: [...DEFAULT_REMINDER_TIMES],
  notifications: false,
  onboardingCompleted: false,
  speechPrivacyAcknowledged: false,
  character: 'anna',
  sounds: true,
  displayName: '',
}

export const DEFAULT_GAME: GameState = {
  freezesAvailable: 0,
  lastFreezeAwardStreak: 0,
  perfectSessions: 0,
  fullSessions: 0,
  comebacks: 0,
  totalXp: 0,
  pendingFreezeNotice: [],
}

/**
 * A stored `app` row over the defaults: rows written by older versions gain the new fields, and the single
 * `reminderTime` of v1.x becomes the list of reminder hours. The list is always valid and never empty.
 */
export function appSettingsFrom(stored: Partial<AppSettings> & { reminderTime?: string }): AppSettings {
  const { reminderTime, ...rest } = stored
  const times = normalizeReminderTimes(rest.reminderTimes ?? (reminderTime ? [reminderTime] : DEFAULT_REMINDER_TIMES))
  return { ...DEFAULT_SETTINGS, ...rest, reminderTimes: times.length > 0 ? times : [...DEFAULT_REMINDER_TIMES] }
}

export const DAY_START_HOURS = { min: 0, max: 6 } as const
export const DAILY_GOAL = { min: 1, max: 150 } as const
