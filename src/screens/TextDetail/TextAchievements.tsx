import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { AchievementRow } from '@/components/AchievementRow'
import { db } from '@/db/schema'
import type { TextItem, TextStats } from '@/db/types'
import { ACHIEVEMENT_RULES, achievementKey, buildTextMetrics } from '@/domain/gamification'

const EMPTY_STATS = { repetitions: 0, bestDayStreak: 0, perfectRuns: 0, bestConsecutiveFirstTry: 0, memoryRuns: 0 }

/** Every per-text rule applies to every text, including new ones (spec §9.5). */
export function TextAchievements({ text, stats, segmentCount }: { text: TextItem; stats?: TextStats; segmentCount: number }) {
  const { t } = useTranslation()
  const unlocked = useLiveQuery(() => db.achievements.where('textId').equals(text.id).toArray(), [text.id])
  const metrics = buildTextMetrics(stats ?? EMPTY_STATS, segmentCount)
  const byKey = new Map((unlocked ?? []).map((row) => [row.key, row]))
  return (
    <section aria-labelledby="text-achievements" className="mt-8">
      <h2 id="text-achievements" className="mb-3 text-2xl font-semibold">
        {t('textDetail.achievementsHeading')}
      </h2>
      <ul className="space-y-2">
        {ACHIEVEMENT_RULES.filter((rule) => rule.scope === 'text').map((rule) => (
          <AchievementRow
            key={rule.id}
            rule={rule}
            row={byKey.get(achievementKey(rule.id, text.id))}
            current={metrics[rule.metric as keyof typeof metrics] ?? 0}
            textTitle={text.title}
          />
        ))}
      </ul>
    </section>
  )
}
