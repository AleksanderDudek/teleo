import type {
  AchievementRow,
  Attempt,
  DailyStats,
  Segment,
  SessionRun,
  SessionTemplate,
  SettingsRow,
  TextItem,
  TextStats,
  XpLedgerRow,
} from '@/db/types'

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
}

export interface BackupFile {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: number
  data: BackupData
}

export type BackupErrorCode = 'notJson' | 'wrongApp' | 'unsupportedVersion' | 'invalidShape'

export type BackupValidation = { ok: true; backup: BackupFile } | { ok: false; code: BackupErrorCode; path?: string }

// --- Small, composable field checks -----------------------------------

const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString)

const isArrayOf =
  (check: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    Array.isArray(v) && v.every(check)

function oneOf<T extends string>(...values: readonly T[]) {
  const set: readonly string[] = values
  return (v: unknown): v is T => typeof v === 'string' && set.includes(v)
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const isDayKey = (v: unknown): v is string => isString(v) && DAY_KEY_RE.test(v)

const isTemplateItem = (v: unknown): boolean => {
  if (!isObject(v)) return false
  if (!isString(v.textId)) return false
  if (!isNumber(v.repeat)) return false
  if (v.segmentIds !== undefined && !isStringArray(v.segmentIds)) return false
  return true
}

// --- Table-driven row validation ---------------------------------------

/** One flat field to check on a row, and the predicate it must satisfy. */
type FieldSpec = readonly [field: string, check: (value: unknown) => boolean]

/** Checks flat fields in order, returning the first failing field name. */
function checkFields(row: Record<string, unknown>, specs: readonly FieldSpec[]): string | undefined {
  for (const [field, check] of specs) {
    if (!check(row[field])) return field
  }
  return undefined
}

/** A row validator returns the failing subpath (possibly `''` for the row itself), or `undefined` if valid. */
type RowValidator = (row: unknown) => string | undefined

function rowValidator(specs: readonly FieldSpec[]): RowValidator {
  return (row) => {
    if (!isObject(row)) return ''
    return checkFields(row, specs)
  }
}

const validateSessionTemplate: RowValidator = (row) => {
  if (!isObject(row)) return ''
  const flat = checkFields(row, [
    ['id', isString],
    ['name', isString],
    ['pinned', isBoolean],
    ['archived', isBoolean],
    ['source', oneOf('builtin', 'user')],
  ])
  if (flat) return flat
  if (!isArrayOf(isTemplateItem)(row.items)) return 'items'
  return undefined
}

const validateSessionRun: RowValidator = (row) => {
  if (!isObject(row)) return ''
  const flat = checkFields(row, [
    ['id', isString],
    ['dayKey', isString],
    ['title', isString],
    ['status', oneOf('in_progress', 'completed', 'partial')],
    ['cursor', isNumber],
    ['startedAt', isNumber],
  ])
  if (flat) return flat
  if (!Array.isArray(row.plan)) return 'plan'
  if (!Array.isArray(row.entries)) return 'entries'
  if (row.plan.length !== row.entries.length) return 'entries'
  return undefined
}

const ROW_VALIDATORS: Record<BackupTable, RowValidator> = {
  texts: rowValidator([
    ['id', isString],
    ['title', isString],
    ['body', isString],
    ['type', oneOf('affirmation', 'prayer', 'text')],
    ['lang', oneOf('pl', 'en')],
    ['source', oneOf('builtin', 'user')],
    ['archived', isBoolean],
    ['splitMode', oneOf('sentence', 'line')],
    ['createdAt', isNumber],
    ['updatedAt', isNumber],
    ['tags', isStringArray],
  ]),
  segments: rowValidator([
    ['id', isString],
    ['textId', isString],
    ['content', isString],
    ['order', isNumber],
    ['wordCount', isNumber],
    ['archived', isBoolean],
  ]),
  sessionTemplates: validateSessionTemplate,
  sessionRuns: validateSessionRun,
  attempts: rowValidator([
    ['id', isString],
    ['segmentId', isString],
    ['textId', isString],
    ['sessionRunId', isString],
    ['dayKey', isString],
    ['timestamp', isNumber],
    ['coverage', isNumber],
    ['accepted', isBoolean],
    ['firstTry', isBoolean],
    ['strictness', oneOf('strict', 'lenient')],
    ['engine', oneOf('webspeech', 'whisper')],
  ]),
  dailyStats: rowValidator([
    ['dayKey', isDayKey],
    ['segmentsAccepted', isNumber],
    ['attempts', isNumber],
    ['xp', isNumber],
    ['langs', isArrayOf(oneOf('pl', 'en'))],
    ['goalReached', isBoolean],
    ['frozen', isBoolean],
  ]),
  textStats: rowValidator([
    ['textId', isString],
    ['repetitions', isNumber],
  ]),
  achievements: rowValidator([
    ['key', isString],
    ['ruleId', isString],
    ['unlockedAt', isNumber],
  ]),
  xpLedger: rowValidator([
    ['timestamp', isNumber],
    ['amount', isNumber],
    ['reason', oneOf('segment', 'textComplete', 'sessionComplete', 'dailyGoal', 'achievement')],
    ['dayKey', isString],
  ]),
  settings: rowValidator([
    ['key', oneOf('app', 'game', 'meta')],
    ['value', isObject],
  ]),
}

// --- Top-level validation -------------------------------------------------

export function validateBackup(value: unknown): BackupValidation {
  if (!isObject(value)) return { ok: false, code: 'invalidShape' }
  if (value.app !== BACKUP_APP) return { ok: false, code: 'wrongApp' }

  const { schemaVersion } = value
  if (!isInt(schemaVersion) || schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, code: 'unsupportedVersion' }
  }

  if (!isNumber(value.exportedAt)) return { ok: false, code: 'invalidShape', path: 'exportedAt' }
  if (!isObject(value.data)) return { ok: false, code: 'invalidShape', path: 'data' }

  const data = value.data
  for (const table of BACKUP_TABLES) {
    const rows = data[table]
    if (!Array.isArray(rows)) return { ok: false, code: 'invalidShape', path: `data.${table}` }

    const validate = ROW_VALIDATORS[table]
    for (let i = 0; i < rows.length; i++) {
      const subpath = validate(rows[i])
      if (subpath !== undefined) {
        const suffix = subpath ? `.${subpath}` : ''
        return { ok: false, code: 'invalidShape', path: `data.${table}[${i}]${suffix}` }
      }
    }
  }

  return { ok: true, backup: value as unknown as BackupFile }
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
