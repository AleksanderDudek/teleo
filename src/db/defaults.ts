import type { AppSettings, GameState } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  uiLang: 'pl',
  theme: 'system',
  engine: 'auto',
  whisperModel: 'base',
  strictness: 'strict',
  dayStartHour: 3,
  dailyGoal: 10,
  handsFree: true,
  saveTranscripts: true,
  fontSize: 'md',
  listenFirst: false,
  grammaticalForm: 'n',
  contentFocus: 'both',
  reminderTime: '07:00',
  onboardingCompleted: false,
  speechPrivacyAcknowledged: false,
  character: 'anna',
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

export const DAY_START_HOURS = { min: 0, max: 6 } as const
export const DAILY_GOAL = { min: 1, max: 150 } as const
