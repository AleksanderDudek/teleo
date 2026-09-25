import { useTranslation } from 'react-i18next'
import { AchievementBadge } from '@/components/AchievementBadge'
import { AchievementRow } from '@/components/AchievementRow'
import type { AchievementRow as AchievementRowData, TextItem, TextStats } from '@/db/types'
import {
  ACHIEVEMENT_RULES,
  achievementKey,
  buildTextMetrics,
  nextTextMilestone,
  type AchievementCategory,
  type GlobalMetric,
} from '@/domain/gamification'
import { achievementName } from '@/i18n/dynamic'

const CATEGORY_ORDER: AchievementCategory[] = ['streak', 'consistency', 'daily', 'volume', 'sessions', 'time', 'other', 'level']

interface GalleryProps {
  global: Record<GlobalMetric, number>
  unlocked: ReadonlyMap<string, AchievementRowData>
  textStats: readonly TextStats[]
  texts: ReadonlyMap<string, TextItem>
  segmentCounts: ReadonlyMap<string, number>
}

export function AchievementGallery({ global, unlocked, textStats, texts, segmentCounts }: GalleryProps) {
  const { t } = useTranslation()
  const globalRules = ACHIEVEMENT_RULES.filter((r) => r.scope === 'global')
  const textRules = ACHIEVEMENT_RULES.filter((r) => r.scope === 'text')
  const practised = textStats.filter((s) => s.repetitions > 0 && texts.has(s.textId))
  const unlockedGlobal = globalRules.filter((r) => unlocked.has(r.id)).length

  return (
    <div className="space-y-6">
      <section aria-labelledby="ach-general">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 id="ach-general" className="text-xl font-semibold">
            {t('progress.general')}
          </h3>
          <span className="text-sm text-ink-soft">{t('progress.unlockedCount', { count: unlockedGlobal, total: globalRules.length })}</span>
        </div>
        <div className="space-y-2">
          {CATEGORY_ORDER.map((category) => {
            const rules = globalRules.filter((r) => r.category === category)
            if (rules.length === 0) return null
            const done = rules.filter((r) => unlocked.has(r.id)).length
            return (
              <details key={category} className="group rounded-2xl border border-line bg-surface/60" open={category === 'streak'}>
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold">
                  <span>{t(`progress.categories.${category}`)}</span>
                  <span className="tabular text-sm font-medium text-ink-soft">
                    {done}/{rules.length}
                  </span>
                </summary>
                <ul className="space-y-2 px-2 pb-2">
                  {rules.map((rule) => (
                    <AchievementRow key={rule.id} rule={rule} row={unlocked.get(rule.id)} current={global[rule.metric as GlobalMetric] ?? 0} />
                  ))}
                </ul>
              </details>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="ach-texts">
        <h3 id="ach-texts" className="mb-3 text-xl font-semibold">
          {t('progress.perText')}
        </h3>
        {practised.length === 0 ? (
          <p className="text-sm text-ink-soft">{t('progress.emptyTexts')}</p>
        ) : (
          <div className="space-y-2">
            {practised.map((stats) => {
              const text = texts.get(stats.textId)!
              const metrics = buildTextMetrics(stats, segmentCounts.get(stats.textId) ?? 0)
              const milestone = nextTextMilestone(metrics, ACHIEVEMENT_RULES)
              const done = textRules.filter((r) => unlocked.has(achievementKey(r.id, text.id))).length
              return (
                <details key={text.id} className="rounded-2xl border border-line bg-surface/60">
                  <summary className="flex cursor-pointer flex-col gap-2 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-lg font-semibold">{text.title}</span>
                      {milestone && (
                        <span className="block text-xs font-semibold text-gold-ink">
                          {t('library.milestone', { remaining: milestone.remaining, name: achievementName(t, milestone.rule.id) })}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1" aria-hidden>
                      {textRules.map((rule) => (
                        <AchievementBadge key={rule.id} tier={rule.tier} locked={!unlocked.has(achievementKey(rule.id, text.id))} className="size-4" />
                      ))}
                    </span>
                    <span className="sr-only">{t('progress.unlockedCount', { count: done, total: textRules.length })}</span>
                  </summary>
                  <ul className="space-y-2 px-2 pb-2">
                    {textRules.map((rule) => (
                      <AchievementRow
                        key={rule.id}
                        rule={rule}
                        row={unlocked.get(achievementKey(rule.id, text.id))}
                        current={metrics[rule.metric as keyof typeof metrics] ?? 0}
                        textTitle={text.title}
                      />
                    ))}
                  </ul>
                </details>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
