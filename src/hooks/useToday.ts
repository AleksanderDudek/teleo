import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { DailyStats, SessionRun, SessionTemplate } from '@/db/types'
import { computeStreak, dayMarksFrom, type StreakInfo } from '@/domain/gamification'
import { countTemplateSegments } from '@/domain/session'
import { isListedTemplate, isListedText } from '@/domain/text/visibility'
import { dayKeyFor } from '@/domain/time/dayKey'
import type { Lang } from '@/domain/types'
import { findResumableRun, segmentsByText } from '@/services/sessions'

export interface StartChoice {
  kind: 'resume' | 'template' | 'daily'
  run?: SessionRun
  template?: SessionTemplate
  segmentCount?: number
}

export interface TodayData {
  today: string
  todayStats?: DailyStats
  streak: StreakInfo
  pinned: Array<{ template: SessionTemplate; segmentCount: number }>
  start: StartChoice
  hasTexts: boolean
  hasActivity: boolean
}

/** Everything the Today screen shows; the Start button follows spec §8.2 (resume → last used → pinned → daily). */
export function useToday(dayStartHour: number, lang: Lang): TodayData | undefined {
  return useLiveQuery(async () => {
    const today = dayKeyFor(Date.now(), dayStartHour)
    const [daily, templates, texts, resumable] = await Promise.all([
      db.dailyStats.toArray(),
      db.sessionTemplates.toArray(),
      db.texts.toArray(),
      findResumableRun(),
    ])
    const textLangs = new Map(texts.map((t) => [t.id, t]))
    const visibleTexts = texts.filter((t) => !t.archived && isListedText(t, lang)).length
    const usable = templates.filter((t) => !t.archived && isListedTemplate(t, textLangs, lang))
    const sized = []
    for (const template of usable) {
      sized.push({ template, segmentCount: countTemplateSegments(template.items, await segmentsByText(template.items)) })
    }
    const playable = sized.filter((s) => s.segmentCount > 0)
    const lastUsed = playable.filter((s) => s.template.lastUsedAt).sort((a, b) => (b.template.lastUsedAt ?? 0) - (a.template.lastUsedAt ?? 0))[0]
    const pinned = playable.filter((s) => s.template.pinned)
    const chosen = lastUsed ?? pinned[0]
    const start: StartChoice = resumable
      ? { kind: 'resume', run: resumable }
      : chosen
        ? { kind: 'template', template: chosen.template, segmentCount: chosen.segmentCount }
        : { kind: 'daily' }
    return {
      today,
      todayStats: daily.find((d) => d.dayKey === today),
      streak: computeStreak(dayMarksFrom(daily), today),
      pinned,
      start,
      hasTexts: visibleTexts > 0,
      hasActivity: daily.some((d) => d.segmentsAccepted > 0),
    }
  }, [dayStartHour, lang])
}
