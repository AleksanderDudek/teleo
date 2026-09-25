import Dexie, { type EntityTable, type Table } from 'dexie'
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
} from './types'

export const DB_NAME = 'teleo'
export const SCHEMA_VERSION = 1

/**
 * IndexedDB schema (spec §10). Boolean fields (`archived`, `pinned`, `accepted`)
 * are deliberately not indexed: IndexedDB cannot index booleans (DECISIONS #10).
 */
export class TeleoDB extends Dexie {
  declare texts: EntityTable<TextItem, 'id'>
  declare segments: EntityTable<Segment, 'id'>
  declare sessionTemplates: EntityTable<SessionTemplate, 'id'>
  declare sessionRuns: EntityTable<SessionRun, 'id'>
  declare attempts: EntityTable<Attempt, 'id'>
  declare dailyStats: EntityTable<DailyStats, 'dayKey'>
  declare textStats: EntityTable<TextStats, 'textId'>
  declare achievements: EntityTable<AchievementRow, 'key'>
  declare xpLedger: EntityTable<XpLedgerRow, 'id'>
  declare settings: Table<SettingsRow, SettingsRow['key']>

  constructor(name = DB_NAME) {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      texts: 'id, lang, type, source, updatedAt',
      segments: 'id, textId, [textId+order]',
      sessionTemplates: 'id, updatedAt',
      sessionRuns: 'id, templateId, dayKey, startedAt, status',
      attempts: 'id, segmentId, textId, sessionRunId, dayKey, timestamp',
      dailyStats: 'dayKey',
      textStats: 'textId',
      achievements: 'key, ruleId, textId, unlockedAt',
      xpLedger: '++id, timestamp, reason',
      settings: 'key',
    })
  }
}

export const db = new TeleoDB()

/** Every table, in export/import order. */
export const ALL_TABLES = [
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
