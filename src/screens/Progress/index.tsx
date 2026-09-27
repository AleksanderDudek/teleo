import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FirstTryChart } from '@/components/progress/FirstTryChart'
import { Heatmap } from '@/components/progress/Heatmap'
import { Plant } from '@/components/progress/Plant'
import { StatTile } from '@/components/progress/StatTile'
import { ArchFrame } from '@/components/ui/ArchFrame'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/Progress'
import { buildGlobalMetrics, computeStreak, dayMarksFrom, levelInfo } from '@/domain/gamification'
import { successMetrics, weeklyFirstTry } from '@/domain/stats'
import { levelName } from '@/i18n/dynamic'
import { useSettingsStore } from '@/stores/settings'
import { AchievementGallery } from './AchievementGallery'
import { Leaderboard } from './Leaderboard'
import { useProgress } from './useProgress'

export default function Progress() {
  const { t, i18n } = useTranslation()
  const app = useSettingsStore((s) => s.app)
  const game = useSettingsStore((s) => s.game)
  const data = useProgress(app.dayStartHour)
  if (!data) return null

  const info = levelInfo(game.totalXp)
  const streak = computeStreak(dayMarksFrom(data.daily), data.today)
  const metrics = successMetrics(data.daily, data.today)
  const global = buildGlobalMetrics({ daily: data.daily, game, ownTexts: data.ownTexts, level: info.level, today: data.today })
  const percent = (value: number | null) => (value === null ? t('progress.noValue') : `${Math.round(value * 100)}%`)
  const number = (value: number) => new Intl.NumberFormat(i18n.language).format(value)
  const repetitions = data.textStats.reduce((sum, s) => sum + s.repetitions, 0)
  const practised = data.textStats
    .filter((s) => s.repetitions > 0 && data.texts.has(s.textId))
    .sort((a, b) => b.repetitions - a.repetitions)

  return (
    <>
      <PageHeader rubric={t('progress.rubric')} title={t('progress.title')} />

      {/* The garden grows in a stained-glass window. */}
      <ArchFrame glow>
        <div className="px-4 pt-10">
          <Plant level={info.level} className="mx-auto h-50 w-full max-w-md" />
        </div>
        <div className="px-5 pt-2 pb-5 text-center">
          <p className="rubric">{t('level.label', { level: info.level })}</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{levelName(t, info.level)}</p>
          <ProgressBar className="mt-3" tone="gold" value={info.xpIntoLevel} max={info.xpForNext} label={t('level.toNext', { xp: info.nextThreshold - game.totalXp, name: levelName(t, info.level + 1) })} />
          <p className="mt-1.5 text-sm text-ink-soft">
            {t('level.xp', { xp: number(game.totalXp) })} · {t('level.toNext', { xp: number(info.nextThreshold - game.totalXp), name: levelName(t, info.level + 1) })}
          </p>
        </div>
      </ArchFrame>

      <Leaderboard />

      <section className="mt-8" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="mb-3 text-2xl font-semibold">
          {t('progress.metricsHeading')}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label={t('progress.firstTry')} value={percent(metrics.firstTryRate)} hint={t('progress.firstTryHint')} />
          <StatTile label={t('progress.goalDays')} value={percent(metrics.goalDayShare)} />
          <StatTile label={t('progress.bestStreak')} value={t('counts.days', { count: streak.best })} />
          <StatTile label={t('progress.totalSegments')} value={number(metrics.totalSegments)} />
          <StatTile label={t('progress.repetitions')} value={number(repetitions)} />
          <StatTile label={t('progress.sessions')} value={number(global.sessionsCompleted)} />
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="heatmap-heading">
        <h2 id="heatmap-heading" className="mb-3 text-2xl font-semibold">
          {t('progress.heatmapTitle')}
        </h2>
        <Card>
          <Heatmap daily={data.daily} today={data.today} goal={app.dailyGoal} />
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="firsttry-heading">
        <h2 id="firsttry-heading" className="text-2xl font-semibold">
          {t('progress.firstTryTitle')}
        </h2>
        <p className="mb-3 text-sm text-ink-soft">{t('progress.firstTrySubtitle')}</p>
        <Card>
          <FirstTryChart weeks={weeklyFirstTry(data.daily, data.today, 12)} />
        </Card>
      </section>

      <section className="mt-8" aria-labelledby="achievements-heading">
        <h2 id="achievements-heading" className="mb-3 text-2xl font-semibold">
          {t('progress.achievementsHeading')}
        </h2>
        <AchievementGallery global={global} unlocked={data.achievements} textStats={data.textStats} texts={data.texts} segmentCounts={data.segmentCounts} />
      </section>

      <section className="mt-8" aria-labelledby="texts-heading">
        <h2 id="texts-heading" className="mb-3 text-2xl font-semibold">
          {t('progress.textsHeading')}
        </h2>
        {practised.length === 0 ? (
          <p className="text-ink-soft">{t('progress.emptyTexts')}</p>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="text-ink-soft">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('progress.colText')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('progress.colReps')}</th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t('progress.colBestStreak')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('progress.colLast')}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {practised.map((stats) => {
                  const text = data.texts.get(stats.textId)!
                  return (
                    <tr key={stats.textId} className="border-t border-line">
                      <td className="px-4 py-2">
                        <Link to={`/library/${encodeURIComponent(text.id)}`} className="font-serif text-base font-semibold hover:underline">
                          {text.title}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right">{number(stats.repetitions)}</td>
                      <td className="hidden px-2 py-2 text-right sm:table-cell">{stats.bestDayStreak}</td>
                      <td className="px-4 py-2 text-right text-ink-soft">
                        {stats.lastPracticedAt ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(stats.lastPracticedAt) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  )
}
