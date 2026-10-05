import { liveQuery, type Subscription } from 'dexie'
import { create } from 'zustand'
import { db, SCHEMA_VERSION } from '@/db/schema'
import { appSettingsFrom, DEFAULT_GAME, DEFAULT_SETTINGS } from '@/db/defaults'
import type { AppSettings, GameState, MetaState } from '@/db/types'

export interface SettingsSnapshot {
  app: AppSettings
  game: GameState
  meta: MetaState
}

/**
 * Synchronous, always-defined mirror of the `settings` table. Filled once during
 * bootstrap, then kept current by a Dexie live query — so components never see
 * an "undefined while loading" state for preferences.
 */
export const useSettingsStore = create<SettingsSnapshot>(() => ({
  app: DEFAULT_SETTINGS,
  game: DEFAULT_GAME,
  meta: { schemaVersion: SCHEMA_VERSION, seedVersion: 0, installedAt: 0 },
}))

let subscription: Subscription | undefined

export function startSettingsSync(initial: SettingsSnapshot): void {
  useSettingsStore.setState(initial)
  subscription?.unsubscribe()
  subscription = liveQuery(() => db.settings.toArray()).subscribe({
    next: (rows) => {
      const patch: Partial<SettingsSnapshot> = {}
      for (const row of rows) {
        if (row.key === 'app') patch.app = appSettingsFrom(row.value)
        else if (row.key === 'game') patch.game = { ...DEFAULT_GAME, ...row.value }
        else patch.meta = row.value
      }
      useSettingsStore.setState(patch)
    },
    error: (error: unknown) => console.error('[teleo] settings sync failed', error),
  })
}

export const useAppSettings = () => useSettingsStore((s) => s.app)
export const useGameState = () => useSettingsStore((s) => s.game)
