import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { AchievementBadge } from '@/components/AchievementBadge'
import { Guardian } from '@/components/brand/Guardian'
import { StatTile } from '@/components/progress/StatTile'
import { ShareDayButton } from '@/components/share/ShareDayButton'
import { formatShare, sharedMinutes } from '@/components/share/shareText'
import { SupportCard } from '@/components/support/SupportCard'
import { ArchFrame } from '@/components/ui/ArchFrame'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ProgressRing } from '@/components/ui/Progress'
import { db } from '@/db/schema'
import { computeStreak, dayMarksFrom, levelInfo } from '@/domain/gamification'
import { summarizeRun } from '@/domain/session'
import { dayKeyFor } from '@/domain/time/dayKey'
import { achievementDescription, achievementName, levelName } from '@/i18n/dynamic'
import { startRun, type StartRunInput } from '@/services/sessions'
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
    return { run, daily, achievements, bible, today: dayKeyFor(now, app.dayStartHour), titles: new Map(texts.map((x) => [x.id, x.title])) }
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

  const { run, daily, achievements, titles, today, bible } = data
  const summary = summarizeRun(run.plan, run.entries)
  const todayStats = daily.find((d) => d.dayKey === today)
  const streak = computeStreak(dayMarksFrom(daily), today).current
  const clean = summary.skipped === 0 && summary.accepted > 0
  const levelBefore = levelInfo(game.totalXp - run.xpEarned).level
  const levelNow = levelInfo(game.totalXp).level
  const again: StartRunInput | null = run.templateId
    ? { kind: 'template', templateId: run.templateId }
    : run.textId
      ? { kind: 'text', textId: run.textId }
      : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-10 text-center">
      {/* The hero window: the Guardian in a stained-glass arch. */}
      <ArchFrame glow className="mt-4 px-5 py-7">
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

      <ShareDayButton
        className="mt-8 text-left"
        character={app.character}
        day={{
          dayKey: today,
          minutes: sharedMinutes(todayStats?.readingMs ?? 0),
          sentences: todayStats?.segmentsAccepted ?? 0,
          streak,
          points: todayStats?.xp ?? 0,
          bibleShare,
        }}
      />

      {/* The only moment the app has just done something for someone: the coffee asks here, once. */}
      <SupportCard dayKey={today} figure={false} className="mt-8 text-left" />

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {bible && (
          <Button
            size="lg"
            icon="play"
            iconFill
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
        )}
        {again && !bible && (
          <Button
            variant="secondary"
            size="lg"
            icon="arrow-counter-clockwise"
            onClick={async () => {
              const next = await startRun(again)
              navigate(`/play/${next.id}`, { replace: true })
            }}
          >
            {t('summary.again')}
          </Button>
        )}
        <ButtonLink to="/" size="lg" icon="house-simple" variant={bible ? 'secondary' : 'primary'}>
          {t('summary.home')}
        </ButtonLink>
      </div>
    </main>
  )
}
