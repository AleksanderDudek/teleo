import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { isListedText, type AchievementRow, type DailyStats, type TextItem, type TextStats } from '@/db/types'
import { dayKeyFor } from '@/domain/time/dayKey'

export interface ProgressData {
  today: string
  daily: DailyStats[]
  textStats: TextStats[]
  texts: Map<string, TextItem>
  achievements: Map<string, AchievementRow>
  segmentCounts: Map<string, number>
  ownTexts: number
}

export function useProgress(dayStartHour: number): ProgressData | undefined {
  return useLiveQuery(async () => {
    const [daily, textStats, texts, achievements, segments] = await Promise.all([
      db.dailyStats.toArray(),
      db.textStats.toArray(),
      db.texts.toArray(),
      db.achievements.toArray(),
      db.segments.toArray(),
    ])
    const segmentCounts = new Map<string, number>()
    for (const s of segments) if (!s.archived) segmentCounts.set(s.textId, (segmentCounts.get(s.textId) ?? 0) + 1)
    return {
      today: dayKeyFor(Date.now(), dayStartHour),
      daily,
      textStats,
      texts: new Map(texts.filter(isListedText).map((t) => [t.id, t])),
      achievements: new Map(achievements.map((a) => [a.key, a])),
      segmentCounts,
      ownTexts: texts.filter((t) => t.source === 'user').length,
    }
  }, [dayStartHour])
}
