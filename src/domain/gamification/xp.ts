import type { Tier } from '@/domain/types'

/** XP awards of spec §9.2. */
export const XP_RULES = {
  segmentBase: 5,
  segmentCap: 30,
  firstTryBonus: 2,
  textCompleteRatio: 0.2,
  sessionComplete: 25,
  dailyGoal: 50,
} as const

/** XP for unlocking an achievement of each tier (spec §9.4). */
export const TIER_XP: Record<Tier, number> = {
  bronze: 50,
  silver: 100,
  gold: 250,
  platinum: 500,
  diamond: 1000,
}

/** Streak bonus on segment XP: 3+ days ×1.1, 7+ ×1.25, 30+ ×1.5 (maximum). */
export function streakMultiplier(streak: number): number {
  if (streak >= 30) return 1.5
  if (streak >= 7) return 1.25
  if (streak >= 3) return 1.1
  return 1
}

export interface SegmentXpBreakdown {
  /** `5 + words`, capped at 30 (a negative word count counts as 0). */
  base: number
  /** First-try bonus (added after the cap). */
  bonus: number
  multiplier: number
  total: number
}

export function segmentXp(
  wordCount: number,
  firstTry: boolean,
  streak: number,
): SegmentXpBreakdown {
  const words = Math.max(0, wordCount)
  const base = Math.min(XP_RULES.segmentBase + words, XP_RULES.segmentCap)
  const bonus = firstTry ? XP_RULES.firstTryBonus : 0
  const multiplier = streakMultiplier(streak)
  return { base, bonus, multiplier, total: Math.round((base + bonus) * multiplier) }
}

/** Bonus for completing a whole text: 20% of the XP its segments earned in that run. */
export function textCompletionXp(segmentXpSum: number): number {
  return Math.round(XP_RULES.textCompleteRatio * segmentXpSum)
}
