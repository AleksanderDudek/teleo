import { ALL_TABLES, db } from '@/db/schema'
import { createBackupFile, parseBackup, type BackupData, type BackupErrorCode, type BackupFile } from '@/domain/backup'
import { dayKeyFor } from '@/domain/time/dayKey'
import { updateMeta } from './settings'

const tables = () => ALL_TABLES.map((name) => db.table(name))

/** Every table in one consistent read (spec §13: full JSON export). */
export async function exportBackup(now = Date.now()): Promise<BackupFile> {
  const data = await db.transaction('r', tables(), async () => {
    const entries = await Promise.all(ALL_TABLES.map(async (name) => [name, await db.table(name).toArray()] as const))
    return Object.fromEntries(entries) as unknown as BackupData
  })
  return createBackupFile(data, now)
}

export function backupFileName(now = Date.now()): string {
  return `teleo-backup-${dayKeyFor(now, 0)}.json`
}

/** Remembers the export for the 30-day backup reminder. */
export async function markBackupDone(now = Date.now()): Promise<void> {
  await updateMeta({ lastBackupAt: now })
}

export type ImportResult = { ok: true } | { ok: false; code: BackupErrorCode; path?: string }

/**
 * Validates a backup and, only if it is valid, replaces ALL local data with it in
 * a single transaction — either everything is restored or nothing changes.
 */
export async function importBackupJson(json: string): Promise<ImportResult> {
  const parsed = parseBackup(json)
  if (!parsed.ok) return { ok: false, code: parsed.code, path: parsed.path }
  const { data } = parsed.backup
  try {
    await db.transaction('rw', tables(), async () => {
      for (const name of ALL_TABLES) {
        const table = db.table(name)
        await table.clear()
        await table.bulkAdd(data[name] as unknown[])
      }
    })
  } catch (error) {
    // e.g. duplicate primary keys: the transaction rolled back, nothing changed.
    console.error('[teleo] backup import rejected by the database', error)
    return { ok: false, code: 'invalidShape', path: error instanceof Error ? error.name : undefined }
  }
  return { ok: true }
}

/** Removes every table's content (the app re-creates defaults on the next start). */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    for (const table of tables()) await table.clear()
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
