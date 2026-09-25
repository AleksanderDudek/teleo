import { useTranslation } from 'react-i18next'
import type { WeeklyRate } from '@/domain/stats'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'

const HEIGHT = 120
const TOP = 16
const BAR = 18

/**
 * Weekly first-try success (single series → no legend; the title names it).
 * Hairline grid at 0/50/100 %, thin bars with rounded data-ends, the latest
 * value labelled, every value in the tooltip and the table view.
 */
export function FirstTryChart({ weeks }: { weeks: readonly WeeklyRate[] }) {
  const { t, i18n } = useTranslation()
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })
  const slot = 30
  const width = weeks.length * slot + 36
  const y = (rate: number) => TOP + (1 - rate) * HEIGHT
  const lastIndex = weeks.findLastIndex((w) => w.rate !== null)
  const pct = (rate: number) => `${Math.round(rate * 100)}%`

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${HEIGHT + TOP + 22}`} className="w-full" role="img" aria-label={t('progress.firstTrySubtitle')}>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={34} x2={width} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth={1} />
            <text x={28} y={y(tick) + 3.5} textAnchor="end" className="tabular fill-ink-soft text-[10px]">
              {pct(tick)}
            </text>
          </g>
        ))}
        {weeks.map((week, i) => {
          const x = 36 + i * slot + (slot - BAR) / 2
          const date = fmt.format(dayKeyToLocalDate(week.weekStart))
          const label = `${t('progress.weekOf', { date })}: ${week.rate === null ? t('progress.noActivity') : pct(week.rate)}`
          return (
            <g key={week.weekStart}>
              {week.rate !== null && week.rate > 0 && (
                <path
                  d={`M${x} ${y(0)} V ${y(week.rate) + 4} Q ${x} ${y(week.rate)} ${x + 4} ${y(week.rate)} H ${x + BAR - 4} Q ${x + BAR} ${y(week.rate)} ${x + BAR} ${y(week.rate) + 4} V ${y(0)} Z`}
                  fill="var(--leaf)"
                />
              )}
              {i === lastIndex && week.rate !== null && (
                <text x={x + BAR / 2} y={y(week.rate) - 5} textAnchor="middle" className="tabular fill-ink text-[11px] font-semibold">
                  {pct(week.rate)}
                </text>
              )}
              {(i === 0 || i === weeks.length - 1) && (
                <text x={x + BAR / 2} y={y(0) + 15} textAnchor="middle" className="fill-ink-soft text-[10px]">
                  {date}
                </text>
              )}
              {/* Hit target larger than the mark (whole slot). */}
              <rect x={36 + i * slot} y={TOP} width={slot} height={HEIGHT} fill="transparent">
                <title>{label}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold text-ink-soft">{t('progress.showTable')}</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-ink-soft">
              <th className="py-1 font-medium">{t('progress.colWeek')}</th>
              <th className="py-1 font-medium">{t('progress.colRate')}</th>
              <th className="py-1 font-medium">{t('progress.colSentences')}</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {weeks.map((week) => (
              <tr key={week.weekStart} className="border-t border-line">
                <td className="py-1">{fmt.format(dayKeyToLocalDate(week.weekStart))}</td>
                <td className="py-1">{week.rate === null ? '—' : pct(week.rate)}</td>
                <td className="py-1">{week.segments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
