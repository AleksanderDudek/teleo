import { useTranslation } from 'react-i18next'
import { GuideBubble } from '@/components/brand/GuideBubble'
import { Icon } from '@/components/icons/Icon'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { cn } from '@/lib/cn'
import { SUPPORT_URL, tipOfTheDay } from './links'

function CoffeeLink({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('support.buttonLabel')}
      className={buttonClasses({ variant: 'gold', size })}
    >
      <Icon name="coffee" size={size === 'sm' ? 16 : 18} tone="plain" />
      {t('support.button')}
    </a>
  )
}

/**
 * Support the author, the gym-training-tracker way: it never blocks the way, never appears during a
 * session and never asks twice on one screen. The Guardian first gives a word for today (worth reading
 * on its own, and different tomorrow); only then comes the coffee.
 */
export function SupportCard({
  dayKey,
  compact,
  figure = true,
  className,
}: {
  dayKey: string
  compact?: boolean
  /** Show the Guardian's portrait; off where he already appears (one Guardian per screen). */
  figure?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  if (compact) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
        <p className="min-w-0 flex-1 text-sm text-ink-soft">{t('support.compact')}</p>
        <CoffeeLink />
      </div>
    )
  }
  return (
    <div className={className}>
      {figure ? (
        <GuideBubble mood="teach" size={84} compact title={`${t('support.rubric')} · ${t('guardian.name')}`}>
          {t(tipOfTheDay(dayKey))}
        </GuideBubble>
      ) : (
        <div className="card card-framed px-4 py-3.5 text-left">
          <p className="rubric">{`${t('support.rubric')} · ${t('guardian.name')}`}</p>
          <p className="mt-1 font-serif text-[1.05rem] leading-snug text-ink">{t(tipOfTheDay(dayKey))}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="min-w-0 flex-1 text-sm text-ink-soft">{t('support.line')}</p>
        <CoffeeLink size="md" />
      </div>
      <p className="mt-1 px-1 text-xs text-ink-faint">{t('support.note')}</p>
    </div>
  )
}
