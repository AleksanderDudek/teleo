import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { GOLDEN_WINDOW } from '@/domain/gamification'
import { cn } from '@/lib/cn'

const MINUTE = 60_000
const pct = (ms: number) => `${(Math.min(Math.max(ms, 0), GOLDEN_WINDOW.endMs) / GOLDEN_WINDOW.endMs) * 100}%`

/**
 * Today's reading time on a 0–15 minute track: lapis up to minute 5, gold leaf through the golden
 * quarter-hour (5–15 min, ×2 points), a check once it is complete.
 */
export function GoldenQuarterHour({ readingMs, className }: { readingMs: number; className?: string }) {
  const { t } = useTranslation()
  const minutes = Math.floor(readingMs / MINUTE)
  const inside = readingMs >= GOLDEN_WINDOW.startMs && readingMs < GOLDEN_WINDOW.endMs
  const done = readingMs >= GOLDEN_WINDOW.endMs
  const message = done
    ? t('golden.done', { minutes })
    : inside
      ? t('golden.inside', { left: Math.ceil((GOLDEN_WINDOW.endMs - readingMs) / MINUTE) })
      : t('golden.before', { minutes })
  const start = pct(GOLDEN_WINDOW.startMs)
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <p className="rubric flex items-center gap-1.5">
          <Icon name="mandorla-star" size={14} />
          {t('golden.title')}
        </p>
        {inside && (
          <span title={t('golden.badgeTitle')} className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink tabular shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent)]">
            {t('golden.badge')}
          </span>
        )}
        {done && <Icon name="check-circle" size={18} tone="plain" className="text-ok" />}
      </div>
      <div
        role="progressbar"
        aria-label={t('golden.label', { minutes })}
        aria-valuemin={0}
        aria-valuemax={15}
        aria-valuenow={Math.min(minutes, 15)}
        className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-sunk shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_30%,transparent)]"
      >
        {/* The golden zone itself, faintly gilded before it is reached. */}
        <span aria-hidden className="absolute inset-y-0 right-0 bg-gold-soft" style={{ left: start }} />
        <span aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700" style={{ width: pct(Math.min(readingMs, GOLDEN_WINDOW.startMs)) }} />
        <span
          aria-hidden
          className={cn('absolute inset-y-0 rounded-r-full bg-gold transition-[width] duration-700', done && 'rounded-l-none')}
          style={{ left: start, width: `calc(${pct(readingMs)} - ${start})`, display: readingMs > GOLDEN_WINDOW.startMs ? undefined : 'none' }}
        />
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-[0.7rem] font-semibold text-ink-faint tabular">
        <span className="absolute left-0">{t('golden.tickStart')}</span>
        <span className="absolute -translate-x-1/2 text-gold-ink" style={{ left: start }}>
          {t('golden.tickGolden')}
        </span>
        <span className="absolute right-0">{t('golden.tickEnd')}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink-soft">{message}</p>
    </div>
  )
}
