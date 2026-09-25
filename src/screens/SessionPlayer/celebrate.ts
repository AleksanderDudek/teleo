import type { TFunction } from 'i18next'
import { XP_RULES } from '@/domain/gamification'
import { achievementName, levelName } from '@/i18n/dynamic'
import type { ProgressOutcome } from '@/services/practice'

/**
 * One quiet line per thing a practice event unlocked (goal, freeze, achievements,
 * level). Shown inside the player instead of toasts, which would cover the text
 * mid-prayer; the summary lists everything again at the end.
 */
export function celebrationLines(outcome: ProgressOutcome, t: TFunction): string[] {
  const lines: string[] = []
  if (outcome.goalReached) lines.push(t('celebrate.goalReached', { xp: XP_RULES.dailyGoal }))
  if (outcome.freezeEarned) lines.push(t('celebrate.freezeEarned'))
  for (const unlock of outcome.unlocked) lines.push(`${t('celebrate.unlocked')}: ${achievementName(t, unlock.ruleId)}`)
  if (outcome.levelUp) lines.push(t('level.up', { name: levelName(t, outcome.levelUp.to) }))
  return lines
}
