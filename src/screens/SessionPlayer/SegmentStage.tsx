import { Fragment, type CSSProperties, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/icons/Icon'
import { DiffLegend, DiffWords } from '@/components/speech/DiffView'
import type { DiffPart } from '@/domain/matcher'
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
  /**
   * The last try was not accepted: its words, coloured, drawn on the sentence itself (said, near, missing, extra) —
   * until the speaker starts the next try.
   */
  diff?: readonly DiffPart[]
  /** The sentence's paragraph (one span per word while heard words are marked): the player scrolls to it. */
  sentenceRef?: Ref<HTMLParagraphElement>
  /** Changes on every accepted sentence; replays the "Great!" beat. */
  praiseKey: number
  /** Unlocked goal/achievements/level from the last sentence, shown quietly. */
  unlockLines: readonly string[]
  repetition?: RepetitionLabel
  /** Memory mode: mask the text (words said so far are revealed). */
  memoryLevel?: MemoryLevel
  /** Hint held down: show the full text. */
  reveal?: boolean
  /** Reward of the last accepted sentence (shown once per `praiseKey`). */
  gain?: { xp: number; golden: boolean; combo: number }
}

/** Above this many words a sentence (a Bible verse, typically) is set one step smaller. */
const LONG_SENTENCE_WORDS = 24

const PRAISE = ['player.praiseGreat', 'player.praiseBeautiful', 'player.praiseWellSaid', 'player.praiseYes', 'player.praiseLovely'] as const

/** Twelve sparks on a ring, alternating long and short throws. */
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + 0.3
  const distance = i % 2 ? 70 : 110
  return { dx: `${Math.round(Math.cos(angle) * distance)}px`, dy: `${Math.round(Math.sin(angle) * distance * 0.6)}px`, size: i % 3 ? 12 : 18 }
})

/** A burst of gold four-point stars from the middle of the sentence. Decorative. */
function Sparks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="absolute text-gold animate-spark"
          style={{ '--dx': spark.dx, '--dy': spark.dy, animationDelay: `${(i % 4) * 25}ms` } as CSSProperties}
        >
          <Icon name="star-four" size={spark.size} tone="plain" fillOpacity={1} />
        </span>
      ))}
    </span>
  )
}

/**
 * Previous and next sentences dimmed around the current one (spec §8.3/1).
 * The "Great!" beat never blocks: the next sentence is shown at once, so a
 * fluent speaker can keep going.
 */
export function SegmentStage({ previous, previousDone, current, next, covered, diff, sentenceRef, praiseKey, unlockLines, repetition, memoryLevel, reveal, gain }: SegmentStageProps) {
  const { t } = useTranslation()
  const words = current.split(/\s+/)
  // The verdict of the last try stays on the sentence until a word of the next try is heard.
  const showDiff = !!diff && !covered?.some(Boolean)
  const masked = !showDiff && memoryLevel && !reveal ? maskWords(current, memoryLevel, covered) : null
  const nextText = next && memoryLevel ? maskWords(next, memoryLevel).map((w) => w.text).join(' ') : next
  return (
    <div className="relative flex w-full max-w-2xl flex-col items-center gap-5 text-center">
      <div className="flex min-h-9 flex-col items-center justify-center gap-1.5">
        {praiseKey > 0 && (
          <span key={praiseKey} className="flex items-center gap-2 animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full bg-ok px-4 py-1.5 font-semibold text-paper shadow-md">
              <Icon name="check" size={16} tone="plain" fillOpacity={0.3} />
              {t(PRAISE[(praiseKey - 1) % PRAISE.length]!)}
            </span>
            {gain && gain.xp > 0 && (
              <span aria-hidden className="text-lg font-bold text-gold-ink tabular animate-float-up [animation-duration:2.2s]">
                +{gain.xp} XP{gain.golden ? ` ${t('golden.badge')}` : ''}
              </span>
            )}
            {gain && gain.combo >= 3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-3 py-1.5 text-sm font-bold text-gold-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent)]">
                <Icon name="flame" size={14} />
                {t('player.combo', { count: gain.combo })}
              </span>
            )}
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

      {/* The sentence sits in a soft gold mandorla; sparks fly out of it (outside the text node). */}
      <div className="relative w-full">
        {praiseKey > 0 && <Sparks key={`s${praiseKey}`} />}
        <p ref={sentenceRef} data-testid="segment-text" data-source={current} className={cn('scripture mandorla px-2 py-[18px]', words.length > LONG_SENTENCE_WORDS && 'scripture-long')}>
          {showDiff && diff ? (
            <DiffWords parts={diff} />
          ) : masked
            ? masked.map((word, i) => (
                <span key={i} className={cn('transition-colors duration-300', word.masked ? 'tracking-[0.08em] text-ink-faint' : 'text-ink')}>
                  {word.text}
                  {i < masked.length - 1 ? ' ' : ''}
                </span>
              ))
            : covered
            ? words.map((word, i) => {
                // Heard words get a gilded marker (joined across the space to the next heard word); unheard
                // ones stay readable — ≥ 3:1 is the WCAG AA bar for this large text.
                const heard = !!covered[i]
                const joined = heard && !!covered[i + 1]
                return (
                  <Fragment key={i}>
                    <span
                      className={cn(
                        'rounded-[3px] transition-colors duration-300 [box-decoration-break:clone]',
                        heard ? 'bg-gold-soft text-ink shadow-[0_2px_0_var(--gold)]' : 'text-ink-soft/70',
                      )}
                    >
                      {word}
                      {joined ? ' ' : ''}
                    </span>
                    {i < words.length - 1 && !joined ? ' ' : ''}
                  </Fragment>
                )
              })
            : current}
        </p>
        {showDiff && (
          <div className="mt-1 flex justify-center">
            <DiffLegend />
          </div>
        )}
        {covered && !showDiff && (
          <span aria-hidden className="mx-auto mt-1 block h-1 w-40 overflow-hidden rounded-full bg-sunk">
            <span
              className="block h-full rounded-full bg-gold transition-[width] duration-300"
              style={{ width: `${(covered.filter(Boolean).length / Math.max(1, words.length)) * 100}%` }}
            />
          </span>
        )}
      </div>

      <p className="line-clamp-2 min-h-12 max-w-xl font-serif text-lg text-ink-faint">
        {next && <span className="sr-only">{t('player.next')}: </span>}
        {nextText}
      </p>
    </div>
  )
}
