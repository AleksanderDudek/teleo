import { db, SCHEMA_VERSION } from '@/db/schema'
import { DEFAULT_GAME, DEFAULT_SETTINGS } from '@/db/defaults'
import type { AppSettings, GameState, MetaState, SettingsRow } from '@/db/types'
import type { Lang } from '@/domain/types'
import { useSettingsStore, type SettingsSnapshot } from '@/stores/settings'

export { DAILY_GOAL, DAY_START_HOURS, DEFAULT_GAME, DEFAULT_SETTINGS } from '@/db/defaults'
export type { SettingsSnapshot } from '@/stores/settings'

/** Preferred UI language from the browser: Polish if the user prefers it, English otherwise. */
export function detectUiLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  const first = languages.find((l) => /^(pl|en)\b/i.test(l))
  return first?.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

function snapshotFrom(rows: readonly SettingsRow[]): SettingsSnapshot {
  let app = DEFAULT_SETTINGS
  let game = DEFAULT_GAME
  let meta: MetaState = { schemaVersion: SCHEMA_VERSION, seedVersion: 0, installedAt: 0 }
  for (const row of rows) {
    // Spread over defaults so rows written by older versions gain new fields.
    if (row.key === 'app') app = { ...DEFAULT_SETTINGS, ...row.value }
    else if (row.key === 'game') game = { ...DEFAULT_GAME, ...row.value }
    else meta = { ...meta, ...row.value }
  }
  return { app, game, meta }
}

export async function readSettings(): Promise<SettingsSnapshot> {
  return snapshotFrom(await db.settings.toArray())
}

/** Creates the settings rows on first launch; returns the current snapshot. */
export async function ensureSettings(now = Date.now()): Promise<SettingsSnapshot> {
  return db.transaction('rw', db.settings, async () => {
    const keys = new Set(await db.settings.toCollection().primaryKeys())
    if (!keys.has('app')) {
      await db.settings.put({ key: 'app', value: { ...DEFAULT_SETTINGS, uiLang: detectUiLang() } })
    }
    if (!keys.has('game')) await db.settings.put({ key: 'game', value: DEFAULT_GAME })
    if (!keys.has('meta')) {
      await db.settings.put({
        key: 'meta',
        value: { schemaVersion: SCHEMA_VERSION, seedVersion: 0, installedAt: now },
      })
    }
    return readSettings()
  })
}

/**
 * Committed writes are copied into the store right away so code that navigates
 * immediately after a write (e.g. finishing onboarding) sees the new values
 * without waiting for the live query round-trip.
 */
function mirror<K extends keyof SettingsSnapshot>(key: K) {
  return (value: SettingsSnapshot[K]): SettingsSnapshot[K] => {
    useSettingsStore.setState({ [key]: value } as Pick<SettingsSnapshot, K>)
    return value
  }
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return db.transaction('rw', db.settings, async () => {
    const { app } = await readSettings()
    const next = { ...app, ...patch }
    await db.settings.put({ key: 'app', value: next })
    return next
  }).then(mirror('app'))
}

export async function updateGameState(patch: Partial<GameState>): Promise<GameState> {
  return db.transaction('rw', db.settings, async () => {
    const { game } = await readSettings()
    const next = { ...game, ...patch }
    await db.settings.put({ key: 'game', value: next })
    return next
  }).then(mirror('game'))
}

export async function updateMeta(patch: Partial<MetaState>): Promise<MetaState> {
  return db.transaction('rw', db.settings, async () => {
    const { meta } = await readSettings()
    const next = { ...meta, ...patch }
    await db.settings.put({ key: 'meta', value: next })
    return next
  }).then(mirror('meta'))
}
