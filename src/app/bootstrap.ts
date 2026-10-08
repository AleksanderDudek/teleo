import { db } from '@/db/schema'
import { initI18n } from '@/i18n'
import { requestPersistentStorage } from '@/services/backup'
import { reconcileStreakFreezes } from '@/services/practice'
import { seedCore, seedLibraryInBackground } from '@/services/seed'
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
  // The core texts before the first screen; the prayer library follows once the app runs (DECISIONS #126).
  const libraryPending = await seedCore()
  // A session still marked as running was interrupted (tab closed): it becomes resumable.
  await markRunningRunsPartial()
  await reconcileStreakFreezes()
  const snapshot = await readSettings()
  startSettingsSync(snapshot)
  await initI18n(snapshot.app.uiLang)
  startAppearanceSync()
  // Spec §10: ask at every start — browsers often grant it only later (e.g. once installed).
  if (snapshot.app.onboardingCompleted) void requestPersistentStorage()
  // `<html data-library>` says whether the prayer library is in yet (e2e tests wait for it instead of racing the writes).
  const markLibrary = (state: 'loading' | 'ready') => (document.documentElement.dataset.library = state)
  if (!libraryPending) markLibrary('ready')
  else {
    markLibrary('loading')
    seedLibraryInBackground().then(
      () => markLibrary('ready'),
      (error: unknown) => console.error('Prayer library not seeded; retried on the next start', error),
    )
  }
}
