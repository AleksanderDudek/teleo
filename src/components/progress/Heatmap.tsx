import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { heatLevel, heatmapWeeks, type DailyLike } from '@/domain/stats'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'
import { cn } from '@/lib/cn'

const WEEKS = 26
const CELL = 13
const GAP = 3

const FILL = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'] as const

/**
 * Calendar heatmap (sequential single-hue ramp, validated for both themes).
 * Frozen days use their own hue with a legend entry; the text summary and the
 * table view keep every value reachable without hovering.
 */
export function Heatmap({ daily, today, goal }: { daily: readonly DailyLike[]; today: DayKey; goal: number }) {
  const { t, i18n } = useTranslation()
  const weeks = useMemo(() => heatmapWeeks(daily, today, WEEKS), [daily, today])
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth // newest weeks first in view on narrow screens
  }, [weeks])

  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })
  const monthFmt = new Intl.DateTimeFormat(i18n.language, { month: 'short' })
  const cells = weeks.flat().filter((c) => !c.future)
  const active = cells.filter((c) => c.segments > 0).length
  const frozen = cells.filter((c) => c.frozen).length
  const width = WEEKS * (CELL + GAP)
  const height = 7 * (CELL + GAP) + 16

  return (
    <figure>
      <figcaption className="sr-only">{t('progress.heatmapSummary', { active, frozen })}</figcaption>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('progress.heatmapSummary', { active, frozen })}>
          {weeks.map((week, w) => {
            const first = week[0]
            const showMonth = first && (w === 0 || dayKeyToLocalDate(first.dayKey).getDate() <= 7)
            return (
              <g key={first?.dayKey ?? w} transform={`translate(${w * (CELL + GAP)} 0)`}>
                {showMonth && first && (
                  <text x={0} y={10} className="fill-ink-soft text-[10px] font-medium">
                    {monthFmt.format(dayKeyToLocalDate(first.dayKey))}
                  </text>
                )}
                {week.map((cell, d) =>
                  cell.future ? null : (
                    <rect
                      key={cell.dayKey}
                      x={0}
                      y={16 + d * (CELL + GAP)}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={cell.frozen && cell.segments === 0 ? 'var(--heat-frozen)' : FILL[heatLevel(cell.segments, goal)]}
                      stroke={cell.today ? 'var(--gold)' : 'none'}
                      strokeWidth={cell.today ? 2 : 0}
                      className="transition-opacity hover:opacity-75"
                    >
                      <title>
                        {cell.frozen && cell.segments === 0
                          ? t('progress.cellFrozen', { date: fmt.format(dayKeyToLocalDate(cell.dayKey)) })
                          : t('progress.cellLabel', { date: fmt.format(dayKeyToLocalDate(cell.dayKey)), count: cell.segments })}
                      </title>
                    </rect>
                  ),
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          {t('progress.less')}
          {FILL.map((fill) => (
            <span key={fill} aria-hidden className="inline-block size-3 rounded-[3px]" style={{ background: fill }} />
          ))}
          {t('progress.more')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-[3px]" style={{ background: 'var(--heat-frozen)' }} />
          {t('progress.frozen')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('inline-block size-3 rounded-[3px] border-2 border-gold')} />
          {t('progress.todayLabel')}
        </span>
      </div>
    </figure>
  )
}
