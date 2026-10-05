import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { AchievementBadge } from '@/components/AchievementBadge'
import { Guardian } from '@/components/brand/Guardian'
import { StatTile } from '@/components/progress/StatTile'
import { ShareSessionButton } from '@/components/share/ShareSessionButton'
import { formatShare } from '@/components/share/shareText'
import { SupportBanner } from '@/components/support/SupportBanner'
import { SupportStrip } from '@/components/support/SupportStrip'
import { ArchFrame } from '@/components/ui/ArchFrame'
import { Icon } from '@/components/icons/Icon'
import { Button, ButtonLink } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { ProgressRing } from '@/components/ui/Progress'
import { db } from '@/db/schema'
import { computeStreak, dayMarksFrom, levelInfo } from '@/domain/gamification'
import { summarizeRun } from '@/domain/session'
import { dayKeyFor } from '@/domain/time/dayKey'
import { achievementDescription, achievementName, levelName } from '@/i18n/dynamic'
import { startRun, type StartRunInput } from '@/services/sessions'
import { taskViews } from '@/services/tasks'
import { useAppSettings, useGameState } from '@/stores/settings'
import { startNextReading, useBibleShare } from '@/screens/Bible/useBible'
import { toast, useUiStore } from '@/stores/ui'

export default function SessionSummary() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { runId } = useParams()
  const app = useAppSettings()
  const game = useGameState()
  const clearToasts = useUiStore((s) => s.clearToasts)
  const bibleShare = useBibleShare()
  const [startingNext, setStartingNext] = useState(false)
  // Celebration toasts from the last sentence would cover this screen, which lists them anyway.
  useEffect(() => clearToasts(), [clearToasts])
  const data = useLiveQuery(async () => {
    const run = runId ? await db.sessionRuns.get(runId) : undefined
    if (!run) return null
    const now = Date.now()
    const until = run.endedAt ?? now
    const [daily, achievements, texts] = await Promise.all([
      db.dailyStats.toArray(),
      run.unlocked
        ? db.achievements.bulkGet(run.unlocked).then((rows) => rows.filter((row) => row !== undefined))
        : db.achievements.where('unlockedAt').between(run.startedAt, until, true, true).toArray(),
      db.texts.toArray(),
    ])
    const bible = run.textId ? texts.find((x) => x.id === run.textId)?.bible : undefined
    // The daily tasks this run advanced, with where they stand now.
    const advanced = new Set((await db.taskLog.where('runId').equals(run.id).toArray()).map((row) => row.taskId))
    const tasks = advanced.size > 0 ? (await taskViews(now)).filter((view) => advanced.has(view.task.id)) : []
    return { run, daily, achievements, bible, tasks, today: dayKeyFor(now, app.dayStartHour), titles: new Map(texts.map((x) => [x.id, x.title])) }
  }, [runId, app.dayStartHour])

  if (data === undefined) return null
  if (data === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-xl">{t('player.notFound')}</p>
        <ButtonLink to="/">{t('errors.home')}</ButtonLink>
      </main>
    )
  }

  const { run, daily, achievements, titles, today, bible, tasks } = data
  const summary = summarizeRun(run.plan, run.entries)
  const todayStats = daily.find((d) => d.dayKey === today)
  const streak = computeStreak(dayMarksFrom(daily), today).current
  const clean = summary.skipped === 0 && summary.accepted > 0
  const levelBefore = levelInfo(game.totalXp - run.xpEarned).level
  const levelNow = levelInfo(game.totalXp).level
  const again: StartRunInput | null = run.taskId
    ? { kind: 'task', taskId: run.taskId }
    : run.templateId
      ? { kind: 'template', templateId: run.templateId }
      : run.textId
        ? { kind: 'text', textId: run.textId }
        : null

  return (
    <>
    <SupportStrip />
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pt-6 text-center sm:px-6">
      {/* The hero window: the Guardian in a stained-glass arch. */}
      <ArchFrame glow className="px-5 py-7">
        <Guardian mood={clean ? 'celebrate' : 'encourage'} size={170} decorative className="mx-auto animate-rise" />
        <p className="rubric mt-2">{run.title}</p>
        <h1 className="mt-1 text-4xl font-semibold">{clean ? t('summary.title') : t('summary.titleIncomplete')}</h1>
        {summary.skipped > 0 && <p className="mt-2 text-ink-soft">{t('summary.skipped', { count: summary.skipped })}</p>}
        {levelNow > levelBefore && (
          <p className="mx-auto mt-4 inline-flex rounded-full bg-gold-soft px-4 py-1.5 font-semibold text-gold-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--gold)_45%,transparent)] animate-rise">
            {t('level.up', { name: levelName(t, levelNow) })}
          </p>
        )}

        {bible && bibleShare !== undefined && (
          <p className="mt-3 font-semibold text-primary">{t('summary.biblePercent', { percent: formatShare(bibleShare, i18n.language) })}</p>
        )}

        <div className="mt-7 flex justify-center">
          <ProgressRing value={todayStats?.segmentsAccepted ?? 0} max={app.dailyGoal} label={t('summary.goal')} size={148}>
            <span className="block text-xs font-semibold tracking-wide text-ink-soft uppercase">{t('summary.goal')}</span>
            <span className="block text-2xl font-semibold">
              {t('summary.goalValue', { done: todayStats?.segmentsAccepted ?? 0, goal: app.dailyGoal })}
            </span>
          </ProgressRing>
        </div>
      </ArchFrame>

      <dl className="mt-6 grid grid-cols-2 gap-3">
        <StatTile sunk label={t('summary.accepted')} value={`${summary.accepted}/${summary.total}`} />
        <StatTile sunk label={t('summary.texts')} value={String(summary.textsCompleted)} />
        <StatTile sunk label={t('summary.firstTry')} value={`${Math.round(summary.firstTryRate * 100)}%`} />
        <StatTile sunk label={t('summary.xp')} value={`+${run.xpEarned}`} />
        <StatTile sunk label={t('summary.streak')} value={String(streak)} />
      </dl>

      {tasks.length > 0 && (
        <ul className="mt-4 space-y-2 text-left">
          {tasks.map((view) => (
            <li key={view.task.id} className="card flex items-center gap-3 p-3">
              <Icon name="list-checks" size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-lg font-semibold">{view.text?.title ?? t('tasks.missingText')}</span>
                <span className="block text-sm text-ink-soft">{t('summary.task', { done: view.progress.doneToday, of: view.task.timesPerDay, day: view.progress.dayIndex, days: view.progress.days })}</span>
              </span>
              <Link to="/tasks" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                {t('summary.taskLink')}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* The result is worth passing on while it is fresh: right under the numbers. */}
      {summary.accepted > 0 && (
        <section className="card mt-4 p-4 text-left">
          <p className="mb-3 text-sm text-ink-soft">{t('share.sessionInvite')}</p>
          <ShareSessionButton
            variant="gold"
            size="md"
            block
            character={app.character}
            session={{
              title: run.title,
              accepted: summary.accepted,
              total: summary.total,
              firstTryRate: summary.firstTryRate,
              xp: run.xpEarned,
              streak,
              bibleShare: bible ? bibleShare : undefined,
            }}
          />
        </section>
      )}

      {achievements.length > 0 && (
        <section className="mt-8 text-left">
          <h2 className="mb-3 text-2xl font-semibold">{t('summary.newAchievements')}</h2>
          <ul className="space-y-2">
            {achievements.map((a, i) => (
              <li key={a.key} className="card flex items-center gap-3 p-3 animate-rise" style={{ animationDelay: `${Math.min(i, 5) * 80}ms` }}>
                <AchievementBadge tier={a.tier} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-semibold">{achievementName(t, a.ruleId)}</p>
                  <p className="text-sm text-ink-soft">{achievementDescription(t, a.ruleId, a.textId ? titles.get(a.textId) : undefined)}</p>
                </div>
                <span className="tabular text-sm font-semibold text-gold-ink">+{a.xp}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Just after the app has done something for someone: the support window, once. */}
      <SupportBanner dayKey={today} className="mt-10 text-left" />

      {/* The next step stays in the thumb zone however long the page gets: one main action, one round one. */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-8 flex items-center gap-3 bg-gradient-to-t from-paper via-paper/95 to-transparent px-5 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)] sm:-mx-6 sm:px-6">
        {bible ? (
          <>
            <Link to="/" aria-label={t('summary.home')} title={t('summary.home')} className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-14 shrink-0 px-0' })}>
              <Icon name="house-simple" size={22} />
            </Link>
            <Button
              size="lg"
              icon="play"
              iconFill
              className="flex-1"
              disabled={startingNext}
              onClick={async () => {
                setStartingNext(true)
                try {
                  const next = await startNextReading(t, bible.translation)
                  navigate(next ? `/play/${next.id}` : '/bible', { replace: true })
                } catch {
                  toast({ kind: 'error', title: t('bible.loadError') })
                  setStartingNext(false)
                }
              }}
            >
              {t('summary.nextReading')}
            </Button>
          </>
        ) : (
          <>
            {again && (
              <button
                type="button"
                aria-label={t('summary.again')}
                title={t('summary.again')}
                disabled={startingNext}
                className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-14 shrink-0 px-0' })}
                onClick={async () => {
                  setStartingNext(true)
                  const next = await startRun(again)
                  navigate(`/play/${next.id}`, { replace: true })
                }}
              >
                <Icon name="arrow-counter-clockwise" size={22} />
              </button>
            )}
            <ButtonLink to="/" size="lg" icon="house-simple" className="flex-1">
              {t('summary.home')}
            </ButtonLink>
          </>
        )}
      </div>
    </main>
    </>
  )
}
