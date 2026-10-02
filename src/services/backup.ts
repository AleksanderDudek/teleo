import { ALL_TABLES, db } from '@/db/schema'
import type { RestorePointRow } from '@/db/types'
import {
  createBackupFile,
  encryptBackup,
  hasProgress,
  parseBackup,
  summarizeBackup,
  withoutRetiredRows,
  type BackupData,
  type BackupErrorCode,
  type BackupFile,
  type BackupSummary,
} from '@/domain/backup'
import { dayKeyFor } from '@/domain/time/dayKey'
import { updateMeta } from './settings'

const tables = () => ALL_TABLES.map((name) => db.table(name))

/** Reads every table; call inside a transaction covering them for a consistent copy. */
async function readAll(): Promise<BackupData> {
  const entries = await Promise.all(ALL_TABLES.map(async (name) => [name, await db.table(name).toArray()] as const))
  return Object.fromEntries(entries) as unknown as BackupData
}

/**
 * Replaces every table with `backup`; call inside a read-write transaction covering them. The only way a backup's
 * data gets into the tables (import and restore points alike), so rows of retired features — language dialogues
 * in older backups and restore points (DECISIONS #118) — are dropped here.
 */
async function replaceAll(backup: BackupData): Promise<void> {
  const data = withoutRetiredRows(backup)
  for (const name of ALL_TABLES) {
    const table = db.table(name)
    await table.clear()
    await table.bulkAdd((data[name] ?? []) as unknown[])
  }
}

/** Every table in one consistent read (spec §13: full JSON export). */
export async function exportBackup(now = Date.now()): Promise<BackupFile> {
  const data = await db.transaction('r', tables(), readAll)
  return createBackupFile(data, now, __APP_VERSION__)
}

export function backupFileName(now = Date.now(), encrypted = false): string {
  return `teleo-backup-${dayKeyFor(now, 0)}${encrypted ? '-protected' : ''}.json`
}

export interface PreparedBackup {
  blob: Blob
  fileName: string
  size: number
  encrypted: boolean
}

/**
 * Builds the backup file before the user saves or shares it (DECISIONS #110): sharing must follow a tap
 * directly, so the slow part — reading everything and, with a password, encrypting — happens first.
 */
export async function prepareBackup(options: { password?: string; iterations?: number; now?: number } = {}): Promise<PreparedBackup> {
  const now = options.now ?? Date.now()
  const file = await exportBackup(now)
  const encrypted = !!options.password
  const content = options.password ? await encryptBackup(file, options.password, { iterations: options.iterations }) : file
  const blob = new Blob([JSON.stringify(content, null, encrypted ? 0 : 1)], { type: 'application/json' })
  return { blob, fileName: backupFileName(now, encrypted), size: blob.size, encrypted }
}

/** Remembers the export for the 30-day backup reminder. */
export async function markBackupDone(now = Date.now()): Promise<void> {
  await updateMeta({ lastBackupAt: now })
}

export type ImportResult = { ok: true } | { ok: false; code: BackupErrorCode | 'noRestorePoint'; path?: string }

/** What is on this device now, in the terms of a backup summary. */
export async function deviceSummary(): Promise<BackupSummary> {
  const [dailyStats, texts, xpLedger, achievements, bibleReadings] = await Promise.all([
    db.dailyStats.toArray(),
    db.texts.toArray(),
    db.xpLedger.toArray(),
    db.achievements.toArray(),
    db.bibleReadings.toArray(),
  ])
  return summarizeBackup({ dailyStats, texts, xpLedger, achievements, bibleReadings })
}

/**
 * Keeps the current data as the restore point before it is replaced — only when it holds any progress (a fresh
 * install has nothing to keep; a stale point would then describe data that is long gone). Inside a transaction.
 */
async function keepCurrent(kind: RestorePointRow['kind'], now: number): Promise<void> {
  const current = await readAll()
  const summary = summarizeBackup(current)
  if (hasProgress(summary)) {
    await db.restorePoints.put({ key: 'previous', kind, createdAt: now, summary, file: createBackupFile(current, now, __APP_VERSION__) })
  } else {
    await db.restorePoints.delete('previous')
  }
}

/**
 * Validates a backup and, only if it is valid, replaces ALL local data with it in a single transaction —
 * either everything is restored or nothing changes. The data it replaces is kept as the restore point
 * (DECISIONS #113), so the restore can be undone.
 */
export async function importBackupJson(json: string, now = Date.now()): Promise<ImportResult> {
  const parsed = parseBackup(json)
  if (!parsed.ok) return { ok: false, code: parsed.code, path: parsed.path }
  const { data } = parsed.backup
  try {
    await db.transaction('rw', [...tables(), db.restorePoints], async () => {
      await keepCurrent('beforeRestore', now)
      await replaceAll(data)
    })
  } catch (error) {
    // e.g. duplicate primary keys: the transaction rolled back, nothing changed.
    console.error('[teleo] backup import rejected by the database', error)
    return { ok: false, code: 'invalidShape', path: error instanceof Error ? error.name : undefined }
  }
  return { ok: true }
}

export async function readRestorePoint(): Promise<RestorePointRow | undefined> {
  return db.restorePoints.get('previous')
}

/**
 * Switches to the restore point: undoes a restore — or, after that, goes back to the restored data. The data in
 * place now (including anything done since) becomes the new restore point, so switching never loses anything.
 */
export async function switchToRestorePoint(now = Date.now()): Promise<ImportResult> {
  try {
    return await db.transaction('rw', [...tables(), db.restorePoints], async (): Promise<ImportResult> => {
      const point = await db.restorePoints.get('previous')
      if (!point) return { ok: false, code: 'noRestorePoint' }
      await keepCurrent(point.kind === 'beforeRestore' ? 'beforeUndo' : 'beforeRestore', now)
      await replaceAll(point.file.data)
      return { ok: true }
    })
  } catch (error) {
    console.error('[teleo] switching to the restore point failed', error)
    return { ok: false, code: 'invalidShape', path: error instanceof Error ? error.name : undefined }
  }
}

/** Removes every table's content and the restore point (the app re-creates defaults on the next start). */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', [...tables(), db.restorePoints], async () => {
    for (const table of tables()) await table.clear()
    await db.restorePoints.clear()
  })
}

/** Asks the browser not to evict our storage (spec §10; important on Safari/iOS). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export interface StorageStatus {
  /** The browser promised not to evict our data; undefined where it cannot tell. */
  persisted?: boolean
  /** Bytes used by this origin (all storage: data, cached app, downloaded models), when known. */
  usage?: number
  quota?: number
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    const [persisted, estimate] = await Promise.all([navigator.storage?.persisted?.(), navigator.storage?.estimate?.()])
    return { persisted, usage: estimate?.usage, quota: estimate?.quota }
  } catch {
    return {}
  }
}
