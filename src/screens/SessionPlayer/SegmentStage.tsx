import { Award, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import type { RepetitionLabel } from './repetition'

interface SegmentStageProps {
  previous?: string
  /** The previous sentence was just accepted: show a check next to it. */
  previousDone: boolean
  current: string
  next?: string
  /** Live mode: which raw words of `current` were already heard. */
  covered?: readonly boolean[]
  /** Changes on every accepted sentence; replays the "Great!" beat. */
  praiseKey: number
  /** Unlocked goal/achievements/level from the last sentence, shown quietly. */
  unlockLines: readonly string[]
  repetition?: RepetitionLabel
}

/**
 * Previous and next sentences dimmed around the current one (spec §8.3/1).
 * The "Great!" beat never blocks: the next sentence is shown at once, so a
 * fluent speaker can keep going.
 */
export function SegmentStage({ previous, previousDone, current, next, covered, praiseKey, unlockLines, repetition }: SegmentStageProps) {
  const { t } = useTranslation()
  const words = current.split(/\s+/)
  return (
    <div className="relative flex w-full max-w-2xl flex-col items-center gap-5 text-center">
      <div className="flex min-h-9 flex-col items-center justify-center gap-1.5">
        {praiseKey > 0 && (
          <span key={praiseKey} className="inline-flex items-center gap-2 rounded-full bg-ok px-4 py-1.5 font-semibold text-paper shadow-md animate-rise">
            <Check aria-hidden className="size-4" strokeWidth={3} />
            {t('player.great')}
          </span>
        )}
        {unlockLines.map((line) => (
          <span key={line} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-ink animate-fade">
            <Award aria-hidden className="size-4" />
            {line}
          </span>
        ))}
      </div>

      <p className="flex min-h-12 max-w-xl items-start justify-center gap-2 font-serif text-lg text-ink-faint">
        {previous && <span className="sr-only">{t('player.previous')}: </span>}
        {previous && previousDone && <Check aria-hidden className="mt-1 size-4 shrink-0 text-ok" strokeWidth={3} />}
        <span className="line-clamp-2 opacity-75">{previous}</span>
      </p>

      {repetition && (
        <div className="flex flex-col items-center gap-2">
          <p className="rubric">
            {repetition.label} · <span className="tabular">{t('player.repetition', { current: repetition.current, total: repetition.total })}</span>
          </p>
          {repetition.single && repetition.total <= 40 && (
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

      <p data-testid="segment-text" className="scripture">
        {covered
          ? words.map((word, i) => (
              <span key={i} className={cn('transition-colors duration-300', covered[i] ? 'text-ink' : 'text-ink-soft')}>
                {word}
                {i < words.length - 1 ? ' ' : ''}
              </span>
            ))
          : current}
      </p>

      <p className="line-clamp-2 min-h-12 max-w-xl font-serif text-lg text-ink-faint opacity-60">
        {next && <span className="sr-only">{t('player.next')}: </span>}
        {next}
      </p>
    </div>
  )
}
