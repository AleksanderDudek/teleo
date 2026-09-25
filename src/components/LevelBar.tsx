import { useTranslation } from 'react-i18next'
import { ProgressBar } from '@/components/ui/Progress'
import { levelInfo } from '@/domain/gamification'
import { levelName } from '@/i18n/dynamic'

export function LevelBar({ totalXp }: { totalXp: number }) {
  const { t } = useTranslation()
  const info = levelInfo(totalXp)
  const next = levelName(t, info.level + 1)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-lg font-semibold">
          {levelName(t, info.level)} <span className="text-sm font-sans font-semibold text-ink-soft">· {t('level.label', { level: info.level })}</span>
        </p>
        <p className="tabular text-sm font-semibold text-gold-ink">{t('level.xp', { xp: totalXp })}</p>
      </div>
      <ProgressBar className="mt-2" tone="gold" value={info.xpIntoLevel} max={info.xpForNext} label={t('level.toNext', { xp: info.nextThreshold - totalXp, name: next })} />
      <p className="mt-1 text-xs text-ink-soft">{t('level.toNext', { xp: info.nextThreshold - totalXp, name: next })}</p>
    </div>
  )
}
