import { db } from '@/db/schema'
import { initI18n } from '@/i18n'
import { ensureSettings } from '@/services/settings'
import { startSettingsSync } from '@/stores/settings'
import { startAppearanceSync } from './appearance'

/**
 * Everything that must happen before the first render: open IndexedDB,
 * create default settings, seed/reconcile data, load translations, apply theme.
 */
export async function bootstrap(): Promise<void> {
  await db.open()
  const snapshot = await ensureSettings()
  startSettingsSync(snapshot)
  await initI18n(snapshot.app.uiLang)
  startAppearanceSync()
}
