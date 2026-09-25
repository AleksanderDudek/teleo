import { db } from '@/db/schema'
import { ensureSettings } from '@/services/settings'

/** Fresh, empty database with default settings rows (fake-indexeddb in tests). */
export async function resetDb(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  await ensureSettings(0)
}
