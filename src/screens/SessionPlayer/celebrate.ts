import type { TFunction } from 'i18next'
import { XP_RULES } from '@/domain/gamification'
import { achievementDescription, achievementName, levelName } from '@/i18n/dynamic'
import type { ProgressOutcome } from '@/services/practice'
import { toast } from '@/stores/ui'

/** Toasts for everything a practice event unlocked (achievements, level, goal, freeze). */
export function celebrate(outcome: ProgressOutcome, t: TFunction, titleOf: (textId: string) => string | undefined) {
  if (outcome.goalReached) toast({ kind: 'success', title: t('celebrate.goalReached', { xp: XP_RULES.dailyGoal }) })
  if (outcome.freezeEarned) toast({ kind: 'info', title: t('celebrate.freezeEarned') })
  for (const unlock of outcome.unlocked) {
    const title = unlock.textId ? titleOf(unlock.textId) : undefined
    toast({
      kind: 'success',
      title: `${t('celebrate.unlocked')}: ${achievementName(t, unlock.ruleId)}`,
      body: `${achievementDescription(t, unlock.ruleId, title)} · ${t('celebrate.xp', { xp: unlock.xp })}`,
      timeoutMs: 6000,
    })
  }
  if (outcome.levelUp) toast({ kind: 'success', title: t('level.up', { name: levelName(t, outcome.levelUp.to) }), timeoutMs: 6000 })
}
