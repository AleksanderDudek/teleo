import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

interface SegmentStageProps {
  previous?: string
  current: string
  next?: string
  /** Live mode: which raw words of `current` were already heard. */
  covered?: readonly boolean[]
  celebrating: boolean
  /** Repetition label such as "Zdrowaś Maryjo · 3/10". */
  repetition?: { label: string; current: number; total: number; single: boolean }
}

/** Previous and next sentences dimmed around the current one, set in large serif (spec §8.3/1). */
export function SegmentStage({ previous, current, next, covered, celebrating, repetition }: SegmentStageProps) {
  const { t } = useTranslation()
  const words = current.split(/\s+/)
  return (
    <div className="relative flex w-full max-w-2xl flex-col items-center gap-6 text-center">
      <p aria-label={t('player.previous')} className="line-clamp-2 min-h-12 max-w-xl font-serif text-lg text-ink-faint opacity-70">
        {previous}
      </p>

      {repetition && (
        <div className="flex flex-col items-center gap-2">
          <p className="rubric">
            {repetition.label} · {t('player.repetition', { current: repetition.current, total: repetition.total })}
          </p>
          {repetition.single && repetition.total <= 30 && (
            <div aria-hidden className="flex max-w-xs flex-wrap justify-center gap-1.5">
              {Array.from({ length: repetition.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'size-2.5 rounded-full transition-colors duration-500',
                    i < repetition.current - 1 ? 'bg-ok' : i === repetition.current - 1 ? 'bg-gold' : 'bg-line-strong',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <p data-testid="segment-text" className={cn('scripture transition-opacity duration-300', celebrating && 'opacity-30')}>
          {covered
            ? words.map((word, i) => (
                <span key={i} className={cn('transition-colors duration-300', covered[i] ? 'text-ink' : 'text-ink-faint')}>
                  {word}{' '}
                </span>
              ))
            : current}
        </p>
        {celebrating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-rise" aria-hidden>
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-ok text-paper shadow-lg">
              <Check className="size-9" strokeWidth={3} />
            </span>
            <span className="font-serif text-3xl font-semibold text-ok">{t('player.great')}</span>
          </div>
        )}
      </div>

      <p aria-label={t('player.next')} className="line-clamp-2 min-h-12 max-w-xl font-serif text-lg text-ink-faint opacity-60">
        {next}
      </p>
    </div>
  )
}
