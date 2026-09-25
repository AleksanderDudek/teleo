import { db } from '@/db/schema'
import type { AchievementRow, DailyStats, GameState } from '@/db/types'
import {
  ACHIEVEMENT_RULES,
  buildGlobalMetrics,
  buildTextMetrics,
  evaluateAchievements,
  levelInfo,
  TIER_XP,
  type TextMetric,
} from '@/domain/gamification'
import { dayKeyFor } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'
import { useSettingsStore } from '@/stores/settings'
import { readSettings } from './settings'

/** Tables an achievement evaluation reads or writes — include them in the caller's transaction. */
export const PROGRESS_TABLES = [db.achievements, db.xpLedger, db.dailyStats, db.textStats, db.texts, db.segments, db.settings] as const

export interface UnlockedAchievement {
  key: string
  ruleId: string
  textId?: string
  tier: AchievementRow['tier']
  xp: number
}

export function emptyDailyStats(dayKey: DayKey): DailyStats {
  return {
    dayKey,
    segmentsAccepted: 0,
    attempts: 0,
    textsCompleted: 0,
    sessionsCompleted: 0,
    xp: 0,
    langs: [],
    goalReached: false,
    frozen: false,
    morning: false,
    evening: false,
    firstTryAccepted: 0,
  }
}

/**
 * Evaluates the achievement rules against the current aggregates and stores new
 * unlocks with their XP (spec §9.8). Achievement XP can raise the level, which can
 * unlock `level.*` rules, so evaluation repeats until nothing new unlocks.
 * Must run inside a transaction over {@link PROGRESS_TABLES}; mutates `game` and
 * the day's stats row (both persisted here).
 */
export async function unlockAchievements(input: {
  game: GameState
  dayKey: DayKey
  now: number
  /** Texts whose per-text metrics may have changed (per-text rules are only checked for these). */
  textIds: readonly string[]
}): Promise<UnlockedAchievement[]> {
  const { game, dayKey, now } = input
  const unlockedKeys = new Set((await db.achievements.toCollection().primaryKeys()) as string[])
  const ownTexts = await db.texts.where('source').equals('user').count()
  const texts: Array<{ textId: string; metrics: Record<TextMetric, number> }> = []
  for (const textId of input.textIds) {
    const stats = await db.textStats.get(textId)
    if (!stats) continue
    const segmentCount = await db.segments.where('textId').equals(textId).filter((s) => !s.archived).count()
    texts.push({ textId, metrics: buildTextMetrics(stats, segmentCount) })
  }

  const all: UnlockedAchievement[] = []
  for (let round = 0; round < 5; round++) {
    const daily = await db.dailyStats.toArray()
    const global = buildGlobalMetrics({ daily, game, ownTexts, level: levelInfo(game.totalXp).level, today: dayKey })
    const fresh = evaluateAchievements({ rules: ACHIEVEMENT_RULES, global, texts, unlocked: unlockedKeys })
    if (fresh.length === 0) break

    const day = (await db.dailyStats.get(dayKey)) ?? emptyDailyStats(dayKey)
    for (const unlock of fresh) {
      const xp = TIER_XP[unlock.tier]
      const row: AchievementRow = { key: unlock.key, ruleId: unlock.ruleId, textId: unlock.textId, tier: unlock.tier, xp, unlockedAt: now }
      await db.achievements.add(row)
      await db.xpLedger.add({ timestamp: now, dayKey, reason: 'achievement', amount: xp, refId: unlock.key })
      unlockedKeys.add(unlock.key)
      game.totalXp += xp
      day.xp += xp
      all.push({ ...unlock, xp })
    }
    await db.dailyStats.put(day)
  }
  await db.settings.put({ key: 'game', value: game })
  return all
}

/**
 * Re-checks global achievements outside a practice event (e.g. `create.*` after
 * adding a text). Opens its own transaction.
 */
export async function evaluateGlobalAchievements(now = Date.now()): Promise<UnlockedAchievement[]> {
  const unlocked = await db.transaction('rw', PROGRESS_TABLES, async () => {
    const { app, game } = await readSettings()
    return unlockAchievements({ game, dayKey: dayKeyFor(now, app.dayStartHour), now, textIds: [] })
  })
  useSettingsStore.setState({ game: (await readSettings()).game })
  return unlocked
}
