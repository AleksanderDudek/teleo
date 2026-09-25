import { Flame, Play, RotateCcw, ShieldCheck, Snowflake, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LevelBar } from '@/components/LevelBar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressRing } from '@/components/ui/Progress'
import { dayKeyToLocalDate } from '@/domain/time/dayKey'
import { useToday } from '@/hooks/useToday'
import { resumeRun, SessionError, startRun } from '@/services/sessions'
import { updateGameState, updateMeta } from '@/services/settings'
import { useSettingsStore } from '@/stores/settings'
import { toast } from '@/stores/ui'

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
  const data = useToday(app.dayStartHour)
  const [now] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)

  if (!data) return null
  const done = data.todayStats?.segmentsAccepted ?? 0
  const left = Math.max(0, app.dailyGoal - done)
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayKeyToLocalDate(data.today))
  const lastBackup = meta.lastBackupAt ?? meta.installedAt
  const showBackup =
    data.hasActivity && now - lastBackup > BACKUP_EVERY_MS && now - (meta.backupReminderSnoozedAt ?? 0) > BACKUP_EVERY_MS

  const begin = async () => {
    setStarting(true)
    try {
      const { start } = data
      if (start.kind === 'resume' && start.run) {
        await resumeRun(start.run.id)
        return navigate(`/play/${start.run.id}`)
      }
      const run =
        start.kind === 'template' && start.template
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

  const startHint =
    data.start.kind === 'resume' && data.start.run
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

  return (
    <>
      <PageHeader rubric={date} title={t(greetingKey(new Date(now).getHours()))} />

      {game.pendingFreezeNotice.length > 0 && (
        <Card className="mb-4 flex items-start gap-3 border-frost/40 bg-frost-soft animate-rise">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-frost" />
          <p className="flex-1 text-sm font-medium text-ink">{t('today.freezeNotice', { count: game.pendingFreezeNotice.length, days: freezeDays })}</p>
          <Button size="sm" variant="ghost" onClick={() => void updateGameState({ pendingFreezeNotice: [] })}>
            {t('common.close')}
          </Button>
        </Card>
      )}

      <section className="card relative overflow-hidden p-6 animate-rise">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-gold-soft/60 blur-3xl" />
        <div className="relative flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold-ink">
                <Flame aria-hidden className="size-6" />
              </span>
              <div>
                <p className="tabular font-serif text-4xl leading-none font-semibold">{data.streak.current}</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {data.streak.current > 0 ? t('today.streak', { count: data.streak.current }) : t('today.streakZero')}
                </p>
              </div>
            </div>
            {data.streak.atRisk && <p className="mt-3 text-sm text-near">{t('today.atRisk')}</p>}
            {game.freezesAvailable > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-frost">
                <Snowflake aria-hidden className="size-4" /> {t('today.freezes', { count: game.freezesAvailable })}
              </p>
            )}
          </div>
          <ProgressRing value={done} max={app.dailyGoal} label={t('today.goal')} size={120}>
            <span className="tabular block font-serif text-3xl leading-none font-semibold">{done}</span>
            <span className="tabular block text-xs font-semibold text-ink-soft">/ {app.dailyGoal}</span>
          </ProgressRing>
        </div>
        <p className="relative mt-4 text-sm font-medium text-ink-soft">
          {t('today.goal')}: {left === 0 ? t('today.goalDone') : t('today.goalLeft', { count: left })}
        </p>
      </section>

      <div className="mt-6 animate-rise [animation-delay:80ms]">
        <Button
          size="lg"
          block
          className="h-16 text-xl"
          disabled={starting || (!data.hasTexts && data.start.kind === 'daily')}
          onClick={() => void begin()}
          icon={data.start.kind === 'resume' ? <RotateCcw aria-hidden className="size-6" /> : <Play aria-hidden className="size-6" fill="currentColor" />}
        >
          {data.start.kind === 'resume' ? t('today.resume') : t('today.start')}
        </Button>
        <p className="mt-2 text-center text-sm text-ink-soft">{data.hasTexts || data.start.kind !== 'daily' ? startHint : t('today.nothingToStart')}</p>
      </div>

      <Card className="mt-6 animate-rise [animation-delay:140ms]">
        <LevelBar totalXp={game.totalXp} />
      </Card>

      {showBackup && (
        <Card className="mt-6 border-gold/50">
          <p className="font-serif text-xl font-semibold">{t('today.backupTitle')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('today.backupBody')}</p>
          <div className="mt-3 flex gap-2">
            <ButtonLink size="sm" to="/settings?section=backup">
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
                  className="card flex w-full items-center gap-4 p-4 text-left transition-transform hover:-translate-y-0.5"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
                    <Play aria-hidden className="size-4" fill="currentColor" />
                  </span>
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
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold-ink">
              <Sparkles aria-hidden className="size-5" />
            </span>
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
