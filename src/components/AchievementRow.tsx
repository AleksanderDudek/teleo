import { useTranslation } from 'react-i18next'
import { AchievementBadge } from '@/components/AchievementBadge'
import { ProgressBar } from '@/components/ui/Progress'
import type { AchievementRow as AchievementRowData } from '@/db/types'
import { ruleProgress, type AchievementRule } from '@/domain/gamification'
import { achievementDescription, achievementName, tierName } from '@/i18n/dynamic'
import { cn } from '@/lib/cn'

/** One achievement: medallion, name (or ??? while hidden), description, unlock date or progress. */
export function AchievementRow({ rule, row, current, textTitle }: { rule: AchievementRule; row?: AchievementRowData; current: number; textTitle?: string }) {
  const { t, i18n } = useTranslation()
  const hidden = rule.hidden && !row
  const progress = ruleProgress(rule, current)
  return (
    <li className={cn('flex items-start gap-3 rounded-2xl p-3', row ? 'bg-surface' : 'bg-sunk/60')}>
      <AchievementBadge tier={rule.tier} locked={!row} className="size-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={cn('font-serif text-lg leading-tight font-semibold', !row && 'text-ink-soft')}>
          {hidden ? '???' : achievementName(t, rule.id)}
          <span className="ml-2 align-middle text-xs font-sans font-semibold text-gold-ink">{tierName(t, rule.tier)}</span>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">{hidden ? t('progress.hiddenBody') : achievementDescription(t, rule.id, textTitle)}</p>
        {row ? (
          <p className="mt-1 text-xs text-ink-faint">
            {t('progress.unlockedOn', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(row.unlockedAt) })}
          </p>
        ) : (
          !hidden && (
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={progress.current} max={progress.threshold} label={`${progress.current} / ${progress.threshold}`} className="h-1.5" />
              <span className="tabular shrink-0 text-xs text-ink-soft">
                {progress.current} / {progress.threshold}
              </span>
            </div>
          )
        )}
      </div>
    </li>
  )
}

