import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { StatTile } from '@/components/progress/StatTile'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import type { HistoryRow } from '@/domain/session/history'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import { useHistory, type HistoryData } from '@/hooks/useHistory'
import { cn } from '@/lib/cn'
import { useAppSettings } from '@/stores/settings'

const PAGE = 30

function Row({ row, data }: { row: HistoryRow; data: HistoryData }) {
  const { t, i18n } = useTranslation()
  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(row.startedAt)
  const minutes = Math.max(1, Math.round(row.durationMs / 60_000))
  const state = row.status === 'completed' ? (row.skipped > 0 ? t('history.withSkips') : t('history.completed')) : row.status === 'partial' ? t('history.paused') : t('history.inProgress')
  const taskTitle = row.taskId ? data.tasks.get(row.taskId) : undefined
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/play/${row.id}/summary`} className="block truncate font-serif text-lg font-semibold text-ink hover:underline">
            {row.title}
          </Link>
          <p className="mt-0.5 text-sm text-ink-soft">
            <span className="tabular">{time}</span> · {t('history.minutes', { count: minutes })} · {state}
            {row.mode === 'memory' && ` · ${t('history.memory')}`}
          </p>
        </div>
        <span className={cn('tabular shrink-0 text-sm font-semibold', row.accepted === row.total ? 'text-ok' : 'text-ink-soft')}>
          {row.accepted}/{row.total}
          {row.xpEarned > 0 && <span className="ml-2 text-gold-ink">+{row.xpEarned}</span>}
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {row.textIds.map((textId) => {
          const text = data.texts.get(textId)
          if (!text) return (
            <span key={textId} className="rounded-full bg-sunk px-2.5 py-1 font-medium text-ink-faint">
              {t('history.deletedText')}
            </span>
          )
          return (
            <Link key={textId} to={text.bible ? '/bible' : `/library/${encodeURIComponent(textId)}`} className="rounded-full bg-sunk px-2.5 py-1 font-medium text-ink hover:bg-gold-soft">
              {text.title}
            </Link>
          )
        })}
        {row.taskId && (
          <Link to="/tasks" className="inline-flex items-center gap-1 rounded-full bg-lapis-soft px-2.5 py-1 font-semibold text-primary hover:underline">
            <Icon name="list-checks" size={12} tone="plain" />
            {taskTitle ? t('history.task', { title: taskTitle }) : t('history.taskGone')}
          </Link>
        )}
        {row.skipped > 0 && <span className="font-medium text-ink-faint">{t('history.skipped', { count: row.skipped })}</span>}
        {row.accepted > 0 && <span className="font-medium text-ink-faint">{t('history.firstTry', { percent: Math.round(row.firstTryRate * 100) })}</span>}
        <Link to={`/play/${row.id}/summary`} className="ml-auto inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
          {t('history.open')}
          <Icon name="caret-right" size={12} tone="plain" />
        </Link>
      </p>
    </li>
  )
}

/** Every session, newest first, grouped by day: what it was about and what was done (owner request 2026-10-05). */
export default function History() {
  const { t, i18n } = useTranslation()
  const { dayStartHour } = useAppSettings()
  const [limit, setLimit] = useState(PAGE)
  const data = useHistory(limit, dayStartHour)
  if (!data) return null

  const days: Array<{ dayKey: string; rows: HistoryRow[] }> = []
  for (const row of data.rows) {
    const last = days.at(-1)
    if (last && last.dayKey === row.dayKey) last.rows.push(row)
    else days.push({ dayKey: row.dayKey, rows: [row] })
  }
  const date = (dayKey: string) => new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(dayKey))
  const tile = (label: string, period: { sessions: number; minutes: number }) => (
    <StatTile label={label} value={String(period.sessions)} hint={t('history.minutesHint', { count: period.minutes })} />
  )

  return (
    <>
      <PageHeader backTo="/progress" rubric={t('history.rubric')} title={t('history.title')} subtitle={t('history.lead')} />

      <dl className="grid grid-cols-3 gap-3">
        {tile(t('history.last7'), data.totals.last7)}
        {tile(t('history.last30'), data.totals.last30)}
        {tile(t('history.all'), data.totals.all)}
      </dl>

      {data.rows.length === 0 ? (
        <EmptyState title={t('history.emptyTitle')} body={t('history.emptyBody')} />
      ) : (
        <div className="mt-8 space-y-8">
          {days.map(({ dayKey, rows }) => (
            <section key={dayKey} aria-labelledby={`day-${dayKey}`}>
              <h2 id={`day-${dayKey}`} className="mb-3 font-serif text-xl font-semibold capitalize">
                {date(dayKey)}
              </h2>
              <ul className="space-y-3">
                {rows.map((row) => (
                  <Row key={row.id} row={row} data={data} />
                ))}
              </ul>
            </section>
          ))}
          {data.count > data.rows.length && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((current) => current + PAGE)}>
                {t('history.more', { count: data.count - data.rows.length })}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
