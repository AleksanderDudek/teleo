import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { wasTried } from '@/domain/session/history'
import type { AchievementRow, DailyStats, TextItem, TextStats } from '@/db/types'
import { isListedText } from '@/domain/text/visibility'
import type { Lang } from '@/domain/types'
import { dayKeyFor } from '@/domain/time/dayKey'

export interface ProgressData {
  today: string
  daily: DailyStats[]
  textStats: TextStats[]
  texts: Map<string, TextItem>
  achievements: Map<string, AchievementRow>
  segmentCounts: Map<string, number>
  ownTexts: number
  /** Sessions ever started (the history card). */
  runs: number
}

export function useProgress(dayStartHour: number, lang: Lang): ProgressData | undefined {
  return useLiveQuery(async () => {
    const [daily, textStats, texts, achievements, segments, runs] = await Promise.all([
      db.dailyStats.toArray(),
      db.textStats.toArray(),
      db.texts.toArray(),
      db.achievements.toArray(),
      db.segments.toArray(),
      db.sessionRuns.filter(wasTried).count(),
    ])
    const segmentCounts = new Map<string, number>()
    for (const s of segments) if (!s.archived) segmentCounts.set(s.textId, (segmentCounts.get(s.textId) ?? 0) + 1)
    return {
      today: dayKeyFor(Date.now(), dayStartHour),
      daily,
      textStats,
      texts: new Map(texts.filter((t) => isListedText(t, lang)).map((t) => [t.id, t])),
      achievements: new Map(achievements.map((a) => [a.key, a])),
      segmentCounts,
      ownTexts: texts.filter((t) => t.source === 'user').length,
      runs,
    }
  }, [dayStartHour, lang])
}
