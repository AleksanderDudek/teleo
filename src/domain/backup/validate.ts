import type {
  AchievementRow,
  Attempt,
  BibleReadingRow,
  FriendRow,
  DailyStats,
  Segment,
  SessionRun,
  SessionTemplate,
  SettingsRow,
  TextItem,
  TextStats,
  XpLedgerRow,
} from '@/db/types'
import { BIBLE_TRANSLATIONS } from '@/domain/bible/types'
import { CHARACTER_IDS } from '@/domain/types'

export const BACKUP_APP = 'teleo'
export const BACKUP_SCHEMA_VERSION = 1

export const BACKUP_TABLES = [
  'texts',
  'segments',
  'sessionTemplates',
  'sessionRuns',
  'attempts',
  'dailyStats',
  'textStats',
  'achievements',
  'xpLedger',
  'settings',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

/** Tables added after the first backup format: optional on import (read as empty when missing). */
export const OPTIONAL_BACKUP_TABLES = ['bibleReadings', 'friends'] as const
export type OptionalBackupTable = (typeof OPTIONAL_BACKUP_TABLES)[number]

export interface BackupData {
  texts: TextItem[]
  segments: Segment[]
  sessionTemplates: SessionTemplate[]
  sessionRuns: SessionRun[]
  attempts: Attempt[]
  dailyStats: DailyStats[]
  textStats: TextStats[]
  achievements: AchievementRow[]
  xpLedger: XpLedgerRow[]
  settings: SettingsRow[]
  bibleReadings?: BibleReadingRow[]
  friends?: FriendRow[]
}

export interface BackupFile {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: number
  data: BackupData
}

export type BackupErrorCode = 'notJson' | 'wrongApp' | 'unsupportedVersion' | 'invalidShape'

export type BackupValidation = { ok: true; backup: BackupFile } | { ok: false; code: BackupErrorCode; path?: string }

// --- A small, composable validation framework ------------------------------
//
// A `Checker` validates one value and returns the subpath of the first
// failure (`''` when the value itself — not a named field of it — is
// invalid), or `undefined` when the value is fine. Composing checkers
// (objects, arrays, optionality) is what lets every row/field validator
// below stay a short declaration instead of a wall of hand-written ifs,
// while still reporting a precise path like `data.texts[3].lang` or
// `data.sessionTemplates[0].items[1].repeat`.

type Checker = (value: unknown) => string | undefined

const isString = (v: unknown): v is string => typeof v === 'string'
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isNonNegativeInt = (v: unknown): v is number => isInt(v) && v >= 0
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const isDayKeyString = (v: unknown): v is string => isString(v) && DAY_KEY_RE.test(v)

function oneOf<T extends string>(...values: readonly T[]) {
  const set: readonly string[] = values
  return (v: unknown): v is T => typeof v === 'string' && set.includes(v)
}

/** Wraps a boolean predicate as a `Checker` on a single, non-composite value. */
const leaf =
  (predicate: (v: unknown) => boolean): Checker =>
  (v) =>
    predicate(v) ? undefined : ''

/** A field/value that may be `undefined`, checked only when present. */
const optional = (checker: Checker): Checker => (v) => (v === undefined ? undefined : checker(v))

/** Prefixes a subpath onto a field/table name (`items` + `[1].repeat` -> `items[1].repeat`). */
function withPrefix(name: string, sub: string | undefined): string | undefined {
  if (sub === undefined) return undefined
  if (sub === '') return name
  return sub.startsWith('[') ? `${name}${sub}` : `${name}.${sub}`
}

const string_: Checker = leaf(isString)
const finiteNumber: Checker = leaf(isFiniteNumber)
const nonNegativeInt: Checker = leaf(isNonNegativeInt)
const boolean_: Checker = leaf(isBoolean)
const dayKey: Checker = leaf(isDayKeyString)
const enumOf = <T extends string>(...values: T[]): Checker => leaf(oneOf(...values))

const arrayOf =
  (element: Checker): Checker =>
  (v) => {
    if (!Array.isArray(v)) return ''
    for (let i = 0; i < v.length; i++) {
      const sub = element(v[i])
      if (sub !== undefined) return sub === '' ? `[${i}]` : `[${i}].${sub}`
    }
    return undefined
  }

const stringArray: Checker = arrayOf(string_)

type FieldSpec = readonly [field: string, checker: Checker]

const objectFields =
  (specs: readonly FieldSpec[]): Checker =>
  (v) => {
    if (!isObject(v)) return ''
    for (const [field, checker] of specs) {
      const sub = withPrefix(field, checker(v[field]))
      if (sub !== undefined) return sub
    }
    return undefined
  }

// --- Shapes nested inside a row ---------------------------------------------

const templateItem: Checker = objectFields([
  ['textId', string_],
  ['repeat', finiteNumber],
  ['segmentIds', optional(stringArray)],
])

const planEntry: Checker = objectFields([
  ['segmentId', string_],
  ['textId', string_],
  ['block', nonNegativeInt],
  ['fullText', boolean_],
  ['item', nonNegativeInt],
])

const entryState: Checker = objectFields([
  ['status', enumOf('pending', 'accepted', 'skipped')],
  ['attempts', nonNegativeInt],
  ['firstTry', boolean_],
  ['xp', finiteNumber],
])

const appSettings: Checker = objectFields([
  ['uiLang', enumOf('pl', 'en')],
  ['theme', enumOf('system', 'light', 'dark')],
  ['engine', enumOf('auto', 'webspeech', 'whisper')],
  ['whisperModel', enumOf('tiny', 'base')],
  ['strictness', enumOf('strict', 'lenient')],
  ['dayStartHour', finiteNumber],
  ['dailyGoal', finiteNumber],
  ['handsFree', boolean_],
  ['saveTranscripts', boolean_],
  ['fontSize', enumOf('sm', 'md', 'lg')],
  ['listenFirst', boolean_],
  ['grammaticalForm', enumOf('m', 'f', 'n')],
  ['contentFocus', enumOf('prayers', 'affirmations', 'both', 'own')],
  ['reminderTime', string_],
  ['onboardingCompleted', boolean_],
  ['speechPrivacyAcknowledged', boolean_],
  // Added in v1.2; older backups omit it and get the default on import.
  ['character', optional(enumOf(...CHARACTER_IDS))],
  ['sounds', optional(boolean_)],
  ['displayName', optional(string_)],
  ['bibleTranslation', optional(enumOf(...BIBLE_TRANSLATIONS))],
])

const gameState: Checker = objectFields([
  ['freezesAvailable', finiteNumber],
  ['lastFreezeAwardStreak', finiteNumber],
  ['perfectSessions', finiteNumber],
  ['fullSessions', finiteNumber],
  ['comebacks', finiteNumber],
  ['totalXp', finiteNumber],
  ['pendingFreezeNotice', arrayOf(dayKey)],
])

const metaState: Checker = objectFields([
  ['schemaVersion', finiteNumber],
  ['seedVersion', finiteNumber],
  ['installedAt', finiteNumber],
  ['lastBackupAt', optional(finiteNumber)],
  ['backupReminderSnoozedAt', optional(finiteNumber)],
  ['shareId', optional(string_)],
])

// --- Table row checkers ------------------------------------------------------

const texts: Checker = objectFields([
  ['id', string_],
  ['title', string_],
  ['body', string_],
  ['type', enumOf('affirmation', 'prayer', 'text')],
  ['lang', enumOf('pl', 'en')],
  ['source', enumOf('builtin', 'user', 'bible')],
  ['archived', boolean_],
  ['splitMode', enumOf('sentence', 'line')],
  ['createdAt', finiteNumber],
  ['updatedAt', finiteNumber],
  ['tags', stringArray],
  ['builtinKey', optional(string_)],
  [
    'bible',
    optional(
      objectFields([
        ['translation', enumOf(...BIBLE_TRANSLATIONS)],
        ['book', string_],
        ['index', nonNegativeInt],
        ['ofBook', nonNegativeInt],
      ]),
    ),
  ],
])

const segments: Checker = objectFields([
  ['id', string_],
  ['textId', string_],
  ['content', string_],
  ['order', finiteNumber],
  ['wordCount', finiteNumber],
  ['archived', boolean_],
])

const sessionTemplates: Checker = objectFields([
  ['id', string_],
  ['name', string_],
  ['pinned', boolean_],
  ['items', arrayOf(templateItem)],
  ['createdAt', finiteNumber],
  ['updatedAt', finiteNumber],
  ['source', enumOf('builtin', 'user')],
  ['archived', boolean_],
  ['lang', optional(enumOf('pl', 'en'))],
  ['builtinKey', optional(string_)],
  ['lastUsedAt', optional(finiteNumber)],
])

/** `cursor` and the plan/entries length match are cross-field, so this row is hand-composed. */
const sessionRuns: Checker = (v) => {
  const flat = objectFields([
    ['id', string_],
    ['title', string_],
    ['dayKey', dayKey],
    ['startedAt', finiteNumber],
    ['status', enumOf('in_progress', 'completed', 'partial')],
    ['plan', arrayOf(planEntry)],
    ['entries', arrayOf(entryState)],
    ['xpEarned', finiteNumber],
    ['lastActivityAt', finiteNumber],
    ['mode', enumOf('read', 'memory')],
    ['templateId', optional(string_)],
    ['textId', optional(string_)],
    ['endedAt', optional(finiteNumber)],
  ])(v)
  if (flat !== undefined) return flat

  const row = v as { plan: unknown[]; entries: unknown[]; cursor: unknown }
  if (row.plan.length !== row.entries.length) return 'entries'
  if (!isInt(row.cursor) || row.cursor < 0 || row.cursor > row.plan.length) return 'cursor'
  return undefined
}

const attempts: Checker = objectFields([
  ['id', string_],
  ['segmentId', string_],
  ['textId', string_],
  ['sessionRunId', string_],
  ['dayKey', dayKey],
  ['timestamp', finiteNumber],
  ['coverage', finiteNumber],
  ['extra', finiteNumber],
  ['wrong', finiteNumber],
  ['accepted', boolean_],
  ['firstTry', boolean_],
  ['strictness', enumOf('strict', 'lenient')],
  ['engine', enumOf('webspeech', 'whisper')],
  ['durationMs', finiteNumber],
  ['transcript', optional(string_)],
])

const dailyStats: Checker = objectFields([
  ['dayKey', dayKey],
  ['segmentsAccepted', finiteNumber],
  ['attempts', finiteNumber],
  ['textsCompleted', finiteNumber],
  ['sessionsCompleted', finiteNumber],
  ['xp', finiteNumber],
  ['langs', arrayOf(enumOf('pl', 'en'))],
  ['goalReached', boolean_],
  ['frozen', boolean_],
  ['morning', boolean_],
  ['evening', boolean_],
  ['firstTryAccepted', finiteNumber],
  ['readingMs', optional(finiteNumber)],
  ['firstActivityAt', optional(finiteNumber)],
  ['lastActivityAt', optional(finiteNumber)],
])

const textStats: Checker = objectFields([
  ['textId', string_],
  ['repetitions', finiteNumber],
  ['segmentsAccepted', finiteNumber],
  ['currentDayStreak', finiteNumber],
  ['bestDayStreak', finiteNumber],
  ['perfectRuns', finiteNumber],
  ['consecutiveFirstTry', finiteNumber],
  ['bestConsecutiveFirstTry', finiteNumber],
  ['memoryRuns', finiteNumber],
  ['lastDayKey', optional(dayKey)],
  ['lastPracticedAt', optional(finiteNumber)],
])

const achievements: Checker = objectFields([
  ['key', string_],
  ['ruleId', string_],
  ['tier', enumOf('bronze', 'silver', 'gold', 'platinum', 'diamond')],
  ['xp', finiteNumber],
  ['unlockedAt', finiteNumber],
  ['textId', optional(string_)],
])

const xpLedger: Checker = objectFields([
  ['timestamp', finiteNumber],
  ['dayKey', dayKey],
  ['reason', enumOf('segment', 'textComplete', 'sessionComplete', 'dailyGoal', 'achievement')],
  ['amount', finiteNumber],
  ['id', optional(finiteNumber)],
  ['refId', optional(string_)],
])

/** `value`'s shape depends on `key`, so this row is a hand-composed discriminated union. */
const settings: Checker = (v) => {
  if (!isObject(v)) return ''
  const valueChecker =
    v.key === 'app' ? appSettings : v.key === 'game' ? gameState : v.key === 'meta' ? metaState : undefined
  if (!valueChecker) return 'key'
  return withPrefix('value', valueChecker(v.value))
}

const bibleReadings: Checker = objectFields([
  ['readingId', string_],
  ['translation', enumOf(...BIBLE_TRANSLATIONS)],
  ['book', string_],
  ['index', nonNegativeInt],
  ['ofBook', nonNegativeInt],
  ['completedAt', finiteNumber],
  ['dayKey', dayKey],
  ['skipped', nonNegativeInt],
])

const periodPoints = (key: Checker): Checker => objectFields([['k', key], ['p', finiteNumber]])

const friends: Checker = objectFields([
  ['v', finiteNumber],
  ['id', string_],
  ['name', string_],
  ['character', enumOf(...CHARACTER_IDS)],
  ['at', finiteNumber],
  ['streak', nonNegativeInt],
  ['day', periodPoints(dayKey)],
  ['week', periodPoints(dayKey)],
  ['month', periodPoints(string_)],
  ['receivedAt', finiteNumber],
])

const OPTIONAL_ROW_CHECKERS: Record<OptionalBackupTable, Checker> = { bibleReadings, friends }

const ROW_CHECKERS: Record<BackupTable, Checker> = {
  texts,
  segments,
  sessionTemplates,
  sessionRuns,
  attempts,
  dailyStats,
  textStats,
  achievements,
  xpLedger,
  settings,
}

// --- Top-level validation -------------------------------------------------

export function validateBackup(value: unknown): BackupValidation {
  if (!isObject(value)) return { ok: false, code: 'invalidShape' }
  if (value.app !== BACKUP_APP) return { ok: false, code: 'wrongApp' }

  const { schemaVersion } = value
  if (!isInt(schemaVersion) || schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, code: 'unsupportedVersion' }
  }

  if (!isFiniteNumber(value.exportedAt)) return { ok: false, code: 'invalidShape', path: 'exportedAt' }
  if (!isObject(value.data)) return { ok: false, code: 'invalidShape', path: 'data' }

  const data = value.data
  for (const table of BACKUP_TABLES) {
    const rows = data[table]
    if (!Array.isArray(rows)) return { ok: false, code: 'invalidShape', path: `data.${table}` }

    // `rows` is already confirmed an array, so `arrayOf` only ever returns
    // `undefined` or an index-prefixed subpath (`[i]` / `[i].field...`) here.
    const sub = arrayOf(ROW_CHECKERS[table])(rows)
    if (sub !== undefined) {
      return { ok: false, code: 'invalidShape', path: `data.${table}${sub}` }
    }
  }

  const normalized: Record<string, unknown> = { ...data }
  for (const table of OPTIONAL_BACKUP_TABLES) {
    const rows = data[table]
    if (rows === undefined) {
      normalized[table] = []
      continue
    }
    if (!Array.isArray(rows)) return { ok: false, code: 'invalidShape', path: `data.${table}` }
    const sub = arrayOf(OPTIONAL_ROW_CHECKERS[table])(rows)
    if (sub !== undefined) return { ok: false, code: 'invalidShape', path: `data.${table}${sub}` }
  }

  return { ok: true, backup: { ...(value as unknown as BackupFile), data: normalized as unknown as BackupData } }
}

export function parseBackup(json: string): BackupValidation {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { ok: false, code: 'notJson' }
  }
  return validateBackup(value)
}

export function createBackupFile(data: BackupData, exportedAt: number): BackupFile {
  return { app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, data }
}
