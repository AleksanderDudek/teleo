import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '@/components/brand/Avatar'
import { GuideBubble } from '@/components/brand/GuideBubble'
import { GoldenQuarterHour } from '@/components/GoldenQuarterHour'
import { LevelBar } from '@/components/LevelBar'
import { ShareDayButton } from '@/components/share/ShareDayButton'
import { sharedMinutes } from '@/components/share/shareText'
import { Icon } from '@/components/icons/Icon'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconHalo } from '@/components/ui/IconHalo'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressRing } from '@/components/ui/Progress'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import { useTodayTasks } from '@/hooks/useTasks'
import { useToday } from '@/hooks/useToday'
import { TaskCard } from '@/screens/Tasks/TaskCard'
import { resumeRun, SessionError, startRun } from '@/services/sessions'
import { updateGameState, updateMeta } from '@/services/settings'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'
import { BibleCard } from '@/screens/Bible/BibleCard'
import { useBibleShare } from '@/screens/Bible/useBible'

const BACKUP_EVERY_MS = 30 * 86_400_000

function greetingKey(hour: number) {
  if (hour >= 4 && hour < 11) return 'today.greetingMorning' as const
  if (hour >= 18 || hour < 4) return 'today.greetingEvening' as const
  return 'today.greetingDay' as const
}

export default function Today() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const app = useSettingsStore((s) => s.app)
  const game = useSettingsStore((s) => s.game)
  const meta = useSettingsStore((s) => s.meta)
  const data = useToday(app.dayStartHour, app.uiLang)
  const tasks = useTodayTasks()
  const bibleShare = useBibleShare()
  const [now] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)

  if (!data) return null
  const done = data.todayStats?.segmentsAccepted ?? 0
  const left = Math.max(0, app.dailyGoal - done)
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(data.today))
  const lastBackup = meta.lastBackupAt ?? meta.installedAt
  const showBackup =
    data.hasActivity && now - lastBackup > BACKUP_EVERY_MS && now - (meta.backupReminderSnoozedAt ?? 0) > BACKUP_EVERY_MS

  // Start follows what the person set up: an unfinished run, then a task still due today, then their session
  // (DECISIONS #128) — a task made a minute ago must not lose to the pinned morning set.
  const startTask = data.start.kind === 'resume' ? undefined : tasks?.find((view) => view.text && view.progress.remainingToday > 0)

  const begin = async () => {
    setStarting(true)
    try {
      const { start } = data
      if (start.kind === 'resume' && start.run) {
        await resumeRun(start.run.id)
        return navigate(`/play/${start.run.id}`)
      }
      const run = startTask
        ? await startRun({ kind: 'task', taskId: startTask.task.id })
        : start.kind === 'template' && start.template
          ? await startRun({ kind: 'template', templateId: start.template.id })
          : await startRun({ kind: 'daily', title: t('today.dailyTitle') })
      navigate(`/play/${run.id}`)
    } catch (error) {
      if (error instanceof SessionError) toast({ kind: 'info', title: t('today.nothingToStart') })
      else throw error
    } finally {
      setStarting(false)
    }
  }

  const startHint = startTask?.text
    ? t('today.taskHint', { name: startTask.text.title, count: startTask.progress.remainingToday })
    : data.start.kind === 'resume' && data.start.run
      ? t('today.resumeHint', {
          name: data.start.run.title,
          done: data.start.run.entries.filter((e) => e.status !== 'pending').length,
          total: data.start.run.plan.length,
        })
      : data.start.kind === 'template' && data.start.template
        ? t('today.startHint', { name: data.start.template.name, count: data.start.segmentCount })
        : t('today.dailyTitle')

  const freezeDays = game.pendingFreezeNotice
    .map((day) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(day)))
    .join(', ')

  const guide = !data.hasTexts ? t('today.guideEmpty') : left === 0 ? t('today.guideDone') : done === 0 ? t('today.guideStart') : t('today.guideLeft', { count: left })

  return (
    <>
      <PageHeader
        rubric={date}
        title={t(greetingKey(new Date(now).getHours()))}
        actions={
          <Link
            to="/settings?section=character"
            aria-label={t('today.yourCharacter', { name: t(`characters.${app.character}`) })}
            className="rounded-full transition-transform hover:-translate-y-0.5"
          >
            <Avatar id={app.character} size={48} decorative />
          </Link>
        }
      />

      {game.pendingFreezeNotice.length > 0 && (
        <Card className="mb-4 flex items-start gap-3 border-frost/40 bg-frost-soft animate-rise">
          <IconHalo icon="shield-cross" tone="frost" size={36} iconSize={20} className="-mt-1" />
          <p className="flex-1 text-sm font-medium text-ink">{t('today.freezeNotice', { count: game.pendingFreezeNotice.length, days: freezeDays })}</p>
          <Button size="sm" variant="ghost" onClick={() => void updateGameState({ pendingFreezeNotice: [] })}>
            {t('common.close')}
          </Button>
        </Card>
      )}

      <section data-tour="goal" className="card card-framed relative overflow-hidden p-6 animate-rise">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-gold-soft/60 blur-3xl" />
        <div className="relative flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <IconHalo icon="candle" size={52} iconSize={26} />
              <div>
                <p className="text-4xl leading-none font-semibold">{data.streak.current}</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {data.streak.current > 0 ? t('today.streak', { count: data.streak.current }) : t('today.streakZero')}
                </p>
              </div>
            </div>
            {data.streak.atRisk && <p className="mt-3 text-sm text-near">{t('today.atRisk')}</p>}
            {game.freezesAvailable > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-frost">
                <Icon name="shield-cross" size={16} tone="plain" /> {t('today.freezes', { count: game.freezesAvailable })}
              </p>
            )}
          </div>
          <ProgressRing value={done} max={app.dailyGoal} label={t('today.goal')} size={120}>
            <span className="block text-3xl leading-none font-semibold">{done}</span>
            <span className="tabular block text-xs font-semibold text-ink-soft">/ {app.dailyGoal}</span>
          </ProgressRing>
        </div>
        <p className="relative mt-4 text-sm font-medium text-ink-soft">
          {t('today.goal')}: {left === 0 ? t('today.goalDone') : t('today.goalLeft', { count: left })}
        </p>
        {data.hasActivity && (
          <>
            <div aria-hidden className="gilt-rule relative my-4" />
            <GoldenQuarterHour readingMs={data.todayStats?.readingMs ?? 0} className="relative" />
          </>
        )}
      </section>

      <div data-tour="start" className="mt-6 animate-rise [animation-delay:80ms]">
        <Button
          size="hero"
          block
          disabled={starting || (!data.hasTexts && data.start.kind === 'daily' && !startTask)}
          onClick={() => void begin()}
          icon={data.start.kind === 'resume' ? 'arrow-counter-clockwise' : 'play'}
          iconFill={data.start.kind !== 'resume'}
        >
          {data.start.kind === 'resume' ? t('today.resume') : t('today.start')}
        </Button>
        <p className="mt-2 text-center text-sm text-ink-soft">{data.hasTexts || data.start.kind !== 'daily' ? startHint : t('today.nothingToStart')}</p>
      </div>

      <GuideBubble mood="welcome" size={92} compact className="mt-6 animate-rise [animation-delay:110ms]">
        {guide}
      </GuideBubble>

      {tasks && tasks.length > 0 && (
        <section className="mt-8" aria-labelledby="today-tasks">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="today-tasks" className="text-2xl font-semibold">
              {t('today.tasks')}
            </h2>
            <Link to="/tasks" className="-my-3 py-3 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              {t('today.allTasks')}
            </Link>
          </div>
          <ul className="space-y-3">
            {tasks.map((view) => (
              <li key={view.task.id}>
                <TaskCard view={view} quiet={view.task.id === startTask?.task.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Points and levels appear once there is something to count: day 0 shows only what to do (DECISIONS #128). */}
      {data.hasActivity && (
        <Card className="mt-6 animate-rise [animation-delay:140ms]">
          <LevelBar totalXp={game.totalXp} />
        </Card>
      )}

      {done > 0 && (
        <ShareDayButton
          className="mt-4"
          character={app.character}
          day={{
            dayKey: data.today,
            minutes: sharedMinutes(data.todayStats?.readingMs ?? 0),
            sentences: done,
            streak: data.streak.current,
            points: data.todayStats?.xp ?? 0,
            bibleShare,
          }}
        />
      )}

      {(bibleShare !== undefined || app.contentFocus === 'prayers' || app.contentFocus === 'both') && (
        <BibleCard className="mt-6" />
      )}

      {showBackup && (
        <Card className="mt-6 border-gold/50">
          <p className="font-serif text-xl font-semibold">{t('today.backupTitle')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('today.backupBody')}</p>
          <div className="mt-3 flex gap-2">
            <ButtonLink size="sm" to="/settings/data">
              {t('today.backupAction')}
            </ButtonLink>
            <Button size="sm" variant="ghost" onClick={() => void updateMeta({ backupReminderSnoozedAt: Date.now() })}>
              {t('today.later')}
            </Button>
          </div>
        </Card>
      )}

      {data.pinned.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-2xl font-semibold">{t('today.pinned')}</h2>
          <ul className="space-y-3">
            {data.pinned.map(({ template, segmentCount }) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={async () => {
                    const run = await startRun({ kind: 'template', templateId: template.id })
                    navigate(`/play/${run.id}`)
                  }}
                  className="card card-lift flex w-full items-center gap-4 p-4 text-left"
                >
                  <IconHalo icon="play" tone="lapis" size={44} iconSize={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-lg font-semibold">{template.name}</span>
                    <span className="block text-sm text-ink-soft">{t('counts.segments', { count: segmentCount })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.hasTexts && (
        <section className="mt-8">
          <Card className="flex items-start gap-4">
            <IconHalo icon="mandorla-star" size={44} iconSize={22} />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl font-semibold">{t('today.daily')}</h2>
              <p className="mt-1 text-sm text-ink-soft">{t('today.dailyBody')}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={async () => {
                  try {
                    const run = await startRun({ kind: 'daily', title: t('today.dailyTitle') })
                    navigate(`/play/${run.id}`)
                  } catch (error) {
                    if (error instanceof SessionError) toast({ kind: 'info', title: t('today.nothingToStart') })
                    else throw error
                  }
                }}
              >
                {t('today.dailyStart')}
              </Button>
            </div>
          </Card>
        </section>
      )}
    </>
  )
}
