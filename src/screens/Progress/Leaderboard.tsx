import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/brand/Avatar'
import { Icon } from '@/components/icons/Icon'
import { systemShare } from '@/components/share/shareSheet'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { db } from '@/db/schema'
import { friendsBoard } from '@/domain/leaderboard/friends'
import { personalBoard, type Period } from '@/domain/leaderboard/periods'
import { dayKeyFor, dayKeyToLocalDate } from '@/domain/time/dayKey'
import { cn } from '@/lib/cn'
import { friendLink, myFriendCard, removeFriend } from '@/services/leaderboard'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'

const CURRENT = { day: 'leaderboard.currentDay', week: 'leaderboard.currentWeek', month: 'leaderboard.currentMonth' } as const
const RANK = { day: 'leaderboard.rankDay', week: 'leaderboard.rankWeek', month: 'leaderboard.rankMonth' } as const
const BEST = { day: 'leaderboard.bestDays', week: 'leaderboard.bestWeeks', month: 'leaderboard.bestMonths' } as const

/**
 * Points by day, week and month. You against your own best periods, and against friends whose cards
 * came through links (there is no server, and religious practice is special-category data — so no
 * global board).
 */
export function Leaderboard() {
  const { t, i18n } = useTranslation()
  const app = useSettingsStore((s) => s.app)
  const [period, setPeriod] = useState<Period>('week')
  const data = useLiveQuery(async () => {
    const [daily, friends] = await Promise.all([db.dailyStats.toArray(), db.friends.toArray()])
    return { daily, friends, today: dayKeyFor(Date.now(), app.dayStartHour) }
  }, [app.dayStartHour])
  if (!data) return null

  const board = personalBoard(data.daily, period, data.today)
  const myName = app.displayName.trim() || t(`characters.${app.character}`)
  const rows = friendsBoard({ name: myName, character: app.character, points: board.current }, data.friends, period, board.currentKey)
  const number = new Intl.NumberFormat(i18n.language)
  const pts = (points: number) => t('leaderboard.points', { points: number.format(Math.round(points)) })
  const periodLabel = (key: string) => {
    if (period === 'month') return new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(`${key}-15T12:00:00`))
    const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(dayKeyToLocalDate(key))
    return period === 'week' ? t('leaderboard.weekOf', { date }) : date
  }

  const challenge = async () => {
    const card = await myFriendCard(t(`characters.${app.character}`))
    const text = t('leaderboard.challengeText', { day: pts(card.day.p), week: pts(card.week.p), month: pts(card.month.p) })
    const result = await systemShare({ text, title: t('leaderboard.challenge'), url: friendLink(card) })
    if (result === 'copied') toast({ kind: 'success', title: t('leaderboard.copied') })
  }

  return (
    <section aria-labelledby="leaderboard-heading" className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="leaderboard-heading" className="text-2xl font-semibold">
          {t('leaderboard.title')}
        </h2>
        <Segmented<Period>
          label={t('leaderboard.period')}
          hideLabel
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'day', label: t('leaderboard.periodDay') },
            { value: 'week', label: t('leaderboard.periodWeek') },
            { value: 'month', label: t('leaderboard.periodMonth') },
          ]}
        />
      </div>
      <Card>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="rubric">{t(CURRENT[period])}</p>
            <p className="mt-1 leading-none whitespace-nowrap">
              <span className="text-4xl font-semibold tabular">{number.format(Math.round(board.current))}</span>{' '}
              <span className="text-base font-semibold text-ink-soft">{t('leaderboard.unit')}</span>
            </p>
          </div>
          <div className="text-right text-sm text-ink-soft">
            <p className="font-semibold text-gold-ink">{t(RANK[period], { rank: board.rank, count: board.periods })}</p>
            <p>{t('leaderboard.best', { points: number.format(Math.round(board.best)) })}</p>
          </div>
        </div>

        <div aria-hidden className="gilt-rule my-4" />
        <h3 className="text-lg font-semibold">{t('leaderboard.friendsHeading')}</h3>
        <ol className="mt-2 space-y-1.5">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className={cn('flex items-center gap-3 rounded-2xl px-2 py-1.5', row.me && 'bg-gold-soft/60 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_45%,transparent)]')}
            >
              <span className="w-5 text-right text-sm font-bold text-gold-ink tabular">{index + 1}</span>
              <Avatar id={row.character} size={36} decorative />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {row.name}
                  {row.me && <span className="ml-1.5 text-xs font-semibold text-gold-ink">· {t('leaderboard.you')}</span>}
                </span>
                {row.stale && <span className="block text-xs text-ink-faint">{t('leaderboard.stale')}</span>}
              </span>
              <span className={cn('font-semibold tabular', row.stale ? 'text-ink-faint' : 'text-ink')}>{pts(row.points)}</span>
              {!row.me && (
                <IconButton label={t('leaderboard.remove', { name: row.name })} icon="x" className="size-8" onClick={() => void removeFriend(row.id)} />
              )}
            </li>
          ))}
        </ol>
        {rows.length === 1 && <p className="mt-2 text-sm text-ink-soft">{t('leaderboard.noFriends')}</p>}
        <div className="mt-4 flex flex-col items-start gap-2">
          <Button size="sm" icon="share-network" onClick={() => void challenge()}>
            {t('leaderboard.challenge')}
          </Button>
          <p className="flex gap-2 text-xs text-ink-faint">
            <Icon name="shield-cross" size={14} className="mt-0.5 text-primary" />
            {t('leaderboard.challengeHint')}
          </p>
        </div>

        {board.top.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-soft">{t(BEST[period])}</summary>
            <ol className="mt-2 space-y-1">
              {board.top.map((entry, index) => (
                <li key={entry.key} className={cn('flex justify-between gap-3 border-t border-line py-1', entry.key === board.currentKey && 'font-semibold text-gold-ink')}>
                  <span>
                    {index + 1}. {periodLabel(entry.key)}
                  </span>
                  <span className="tabular">{pts(entry.points)}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </Card>
    </section>
  )
}
