import { db } from '@/db/schema'
import { initI18n } from '@/i18n'
import { reconcileStreakFreezes } from '@/services/practice'
import { seedBuiltins } from '@/services/seed'
import { markRunningRunsPartial } from '@/services/sessions'
import { ensureSettings, readSettings } from '@/services/settings'
import { startSettingsSync } from '@/stores/settings'
import { startAppearanceSync } from './appearance'

/**
 * Everything that must happen before the first render: open IndexedDB,
 * create default settings, seed/reconcile data, load translations, apply theme.
 */
export async function bootstrap(): Promise<void> {
  await db.open()
  await ensureSettings()
  await seedBuiltins()
  // A session still marked as running was interrupted (tab closed): it becomes resumable.
  await markRunningRunsPartial()
  await reconcileStreakFreezes()
  const snapshot = await readSettings()
  startSettingsSync(snapshot)
  await initI18n(snapshot.app.uiLang)
  startAppearanceSync()
}
