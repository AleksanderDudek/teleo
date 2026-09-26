import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { maskWords, type MemoryLevel } from '@/domain/memory/mask'
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
  /** Memory mode: mask the text (words said so far are revealed). */
  memoryLevel?: MemoryLevel
  /** Hint held down: show the full text. */
  reveal?: boolean
}

/**
 * Previous and next sentences dimmed around the current one (spec §8.3/1).
 * The "Great!" beat never blocks: the next sentence is shown at once, so a
 * fluent speaker can keep going.
 */
export function SegmentStage({ previous, previousDone, current, next, covered, praiseKey, unlockLines, repetition, memoryLevel, reveal }: SegmentStageProps) {
  const { t } = useTranslation()
  const words = current.split(/\s+/)
  const masked = memoryLevel && !reveal ? maskWords(current, memoryLevel, covered) : null
  const nextText = next && memoryLevel ? maskWords(next, memoryLevel).map((w) => w.text).join(' ') : next
  return (
    <div className="relative flex w-full max-w-2xl flex-col items-center gap-5 text-center">
      <div className="flex min-h-9 flex-col items-center justify-center gap-1.5">
        {praiseKey > 0 && (
          <span key={praiseKey} className="inline-flex items-center gap-2 rounded-full bg-ok px-4 py-1.5 font-semibold text-paper shadow-md animate-rise">
            <Icon name="check" size={16} tone="plain" fillOpacity={0.3} />
            {t('player.great')}
          </span>
        )}
        {unlockLines.map((line) => (
          <span key={line} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-ink animate-fade">
            <Icon name="crown-jewel" size={16} />
            {line}
          </span>
        ))}
      </div>

      <p className="flex min-h-12 max-w-xl items-start justify-center gap-2 font-serif text-lg text-ink-soft">
        {previous && <span className="sr-only">{t('player.previous')}: </span>}
        {previous && previousDone && <Icon name="check" size={16} tone="plain" fillOpacity={0.3} className="mt-1 text-ok" />}
        <span className="line-clamp-2">{previous}</span>
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

      {/* The sentence sits in a soft gold mandorla. */}
      <p data-testid="segment-text" className="scripture mandorla px-2 py-[18px]">
        {masked
          ? masked.map((word, i) => (
              <span key={i} className={cn('transition-colors duration-300', word.masked ? 'tracking-[0.08em] text-ink-faint' : 'text-ink')}>
                {word.text}
                {i < masked.length - 1 ? ' ' : ''}
              </span>
            ))
          : covered
          ? words.map((word, i) => (
              // Unheard words stay readable: ≥ 3:1 is the WCAG AA bar for this large text.
              <span key={i} className={cn('transition-colors duration-300', covered[i] ? 'text-ink' : 'text-ink-soft/70')}>
                {word}
                {i < words.length - 1 ? ' ' : ''}
              </span>
            ))
          : current}
      </p>

      <p className="line-clamp-2 min-h-12 max-w-xl font-serif text-lg text-ink-faint">
        {next && <span className="sr-only">{t('player.next')}: </span>}
        {nextText}
      </p>
    </div>
  )
}
