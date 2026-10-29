import Dexie, { type EntityTable, type Table } from 'dexie'
import { withRenamedKeys } from '@/domain/backup/renamed'
import { RETIRED_TEXT_SOURCES, retiredRows } from '@/domain/backup/retired'
import { DB_NAME } from './name'
import type {
  AchievementRow,
  Attempt,
  BibleReadingRow,
  FriendRow,
  DailyStats,
  RestorePointRow,
  Segment,
  SessionRun,
  SessionTemplate,
  SettingsRow,
  TaskLogRow,
  TaskRow,
  TextItem,
  TextStats,
  XpLedgerRow,
} from './types'

export { DB_NAME } from './name'
export const SCHEMA_VERSION = 6

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
  declare bibleReadings: EntityTable<BibleReadingRow, 'readingId'>
  declare friends: EntityTable<FriendRow, 'id'>
  declare restorePoints: EntityTable<RestorePointRow, 'key'>
  declare tasks: EntityTable<TaskRow, 'id'>
  declare taskLog: EntityTable<TaskLogRow, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({
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
    // v1.3: Bible challenge progress and the friends' leaderboard (new tables only, no data migration).
    this.version(2).stores({
      bibleReadings: 'readingId, [translation+book], dayKey',
      friends: 'id',
    })
    // v1.4: the data an import replaced, kept for "undo" (new table only; never exported).
    this.version(3).stores({
      restorePoints: 'key',
    })
    // v1.5: language dialogues moved to their own app (DECISIONS #117–#118). The rows they left are deleted;
    // attempts, daily stats and points stay. Restore points keep theirs until used: a restore drops them.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        const retired = retiredRows(await tx.table('texts').where('source').anyOf(RETIRED_TEXT_SOURCES).toArray())
        if (retired.textIds.size === 0) return
        const ids = [...retired.textIds]
        await tx.table('texts').bulkDelete(ids)
        // Indexed by text where possible (a long Bible history makes these tables large); runs have no such index.
        await tx.table('segments').where('textId').anyOf(ids).delete()
        await tx.table('textStats').bulkDelete(ids)
        await tx.table('achievements').where('textId').anyOf(ids).delete()
        await tx.table('sessionRuns').filter(retired.sessionRun).delete()
      })
    // v1.6: daily tasks and their repetition log (new tables only, no data migration).
    this.version(5).stores({
      tasks: 'id, textId, endDay',
      taskLog: 'id, taskId, [taskId+dayKey], dayKey, runId',
    })
    // v1.7: the library prayers moved to keys that name no person (DECISIONS #134). Their ids are kept in most tables,
    // some as a primary key (a text, its stats, a per-text achievement), so changed rows are deleted and written again.
    // Restore points are renamed when used, like every restore.
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        for (const name of ALL_TABLES) {
          const table = tx.table(name)
          const rows: object[] = await table.toArray()
          const changed = rows.flatMap((row) => {
            const renamed = withRenamedKeys(row)
            return renamed === row ? [] : [{ row, renamed }]
          })
          if (changed.length === 0) continue
          const keyPath = table.schema.primKey.keyPath as string
          await table.bulkDelete(changed.map(({ row }) => Dexie.getByKeyPath(row, keyPath)))
          await table.bulkAdd(changed.map(({ renamed }) => renamed))
        }
      })
  }
}

export const db = new TeleoDB()

/** Every table, in export/import order (`restorePoints` is local only: never exported). */
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
  'bibleReadings',
  'friends',
  'tasks',
  'taskLog',
] as const
