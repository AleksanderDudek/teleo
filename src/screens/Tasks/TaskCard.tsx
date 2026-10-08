import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import { Link, useNavigate } from 'react-router'
import { Icon } from '@/components/icons/Icon'
import { Button } from '@/components/ui/Button'
import { IconHalo } from '@/components/ui/IconHalo'
import { cn } from '@/lib/cn'
import { SessionError, startRun } from '@/services/sessions'
import type { TaskView } from '@/services/tasks'
import { toast } from '@/stores/ui'

/** Today's target as pips: one per repetition, filled once said. */
export function TaskPips({ done, of, className }: { done: number; of: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <span role="img" aria-label={t('tasks.todayProgress', { done, of })} title={t('tasks.todayProgress', { done, of })} className={cn('inline-flex items-center gap-1', className)}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} aria-hidden className={cn('size-2.5 rounded-full', i < done ? 'bg-gold shadow-[0_0_0_1px_var(--gold-ink)]' : 'bg-sunk shadow-[inset_0_0_0_1px_var(--line-strong)]')} />
      ))}
    </span>
  )
}

interface TaskCardProps {
  view: TaskView
  /** Extra actions under the card (manage screen). */
  actions?: ReactNode
  /** Today's Start already says this task: its own button steps back to secondary. */
  quiet?: boolean
  className?: string
}

/**
 * One daily task: the text (a link to it in the library), where the task stands (day k of n, today done/of) and
 * "Say it", which starts a run of the repetitions left today. Finished for today → a check instead.
 */
export function TaskCard({ view, actions, quiet, className }: TaskCardProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { task, text, progress } = view
  const [starting, setStarting] = useState(false)
  const dueToday = progress.remainingToday > 0
  const doneToday = progress.dayIndex >= 1 && !progress.over && !task.archived && progress.remainingToday === 0

  const say = async () => {
    setStarting(true)
    try {
      const run = await startRun({ kind: 'task', taskId: task.id })
      navigate(`/play/${run.id}`)
    } catch (error) {
      if (error instanceof SessionError) toast({ kind: 'error', title: t('tasks.cantStart') })
      else throw error
    } finally {
      setStarting(false)
    }
  }

  const status = task.archived
    ? t('tasks.stopped')
    : progress.over
      ? progress.complete
        ? t('tasks.finishedComplete')
        : t('tasks.finished', { done: progress.doneTotal, total: progress.total })
      : progress.dayIndex === 0
        ? t('tasks.startsOn', { date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(task.startDay)) })
        : t('tasks.dayOf', { day: progress.dayIndex, days: progress.days })

  return (
    <div className={cn('card p-4', (task.archived || progress.over) && 'opacity-80', className)}>
      <div className="flex items-start gap-4">
        <IconHalo icon={doneToday ? 'check-circle' : 'list-checks'} tone={doneToday ? 'gold' : dueToday ? 'lapis' : 'sunk'} size={44} iconSize={22} />
        <div className="min-w-0 flex-1">
          {text ? (
            <Link to={`/library/${encodeURIComponent(text.id)}`} className="line-clamp-2 font-serif text-xl leading-tight font-semibold text-ink hover:underline">
              {text.title}
            </Link>
          ) : (
            <p className="line-clamp-2 font-serif text-xl leading-tight font-semibold text-ink-faint">{t('tasks.missingText')}</p>
          )}
          <p className="mt-0.5 text-sm text-ink-soft">
            {t('tasks.timesPerDay', { count: task.timesPerDay })} · {status}
          </p>
          {!task.archived && !progress.over && progress.dayIndex >= 1 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-ink">
              <TaskPips done={progress.doneToday} of={task.timesPerDay} />
              <span className="tabular">{t('tasks.todayProgress', { done: progress.doneToday, of: task.timesPerDay })}</span>
              <span className="tabular text-ink-faint">{t('tasks.totalProgress', { done: progress.doneTotal, total: progress.total })}</span>
            </p>
          )}
          {/* Under the title, not beside it: on a phone a side button left the title a few characters. */}
          {dueToday && text ? (
            <Button
              className="mt-3"
              variant={quiet ? 'secondary' : 'primary'}
              onClick={() => void say()}
              disabled={starting}
              icon="mic-halo"
              aria-label={t('tasks.sayLabel', { title: text.title })}
            >
              {t('tasks.say')}
            </Button>
          ) : (
            doneToday && (
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ok">
                <Icon name="check" size={16} tone="plain" fillOpacity={0.3} />
                {t('tasks.doneToday')}
              </p>
            )
          )}
        </div>
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2">{actions}</div>}
    </div>
  )
}
