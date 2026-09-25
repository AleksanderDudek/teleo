import type { TFunction } from 'i18next'
import { toRoman } from '@/domain/gamification'
import type { AchievementRule } from '@/domain/gamification'

/**
 * Keys built at runtime (rule ids, level numbers) can't be checked by the typed
 * `t`; they are covered by tests instead (every rule/level has PL + EN strings).
 */
function tKey(t: TFunction, key: string, options?: Record<string, unknown>): string {
  return (t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, options)
}

export function achievementName(t: TFunction, ruleId: string): string {
  return tKey(t, `achievements.${ruleId}.name`)
}

export function achievementDescription(t: TFunction, ruleId: string, textTitle?: string): string {
  return tKey(t, `achievements.${ruleId}.desc`, { title: textTitle ?? '' })
}

export function tierName(t: TFunction, tier: AchievementRule['tier']): string {
  return tKey(t, `tiers.${tier}`)
}

/** "Sprout", or "Teleo II" past level 20. */
export function levelName(t: TFunction, level: number): string {
  if (level <= 20) return tKey(t, `levelNames.${level}`)
  return t('level.circle', { roman: toRoman(level - 20) })
}
