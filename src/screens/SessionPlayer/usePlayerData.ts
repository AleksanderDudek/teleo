import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Segment, SessionRun, TextItem } from '@/db/types'
import { dayKeyFor } from '@/domain/time/dayKey'

export interface PlayerData {
  run: SessionRun
  segments: Map<string, Segment>
  texts: Map<string, TextItem>
  /** Today's estimated reading time (drives the golden quarter-hour badge). */
  readingMsToday: number
}

/** The run (live) plus the segments/texts of its plan. `null` = not found. */
export function usePlayerData(runId: string | undefined, dayStartHour: number): PlayerData | null | undefined {
  return useLiveQuery(async () => {
    if (!runId) return null
    const run = await db.sessionRuns.get(runId)
    if (!run) return null
    const segmentIds = [...new Set(run.plan.map((e) => e.segmentId))]
    const textIds = [...new Set(run.plan.map((e) => e.textId))]
    const [segments, texts, today] = await Promise.all([
      db.segments.bulkGet(segmentIds),
      db.texts.bulkGet(textIds),
      db.dailyStats.get(dayKeyFor(Date.now(), dayStartHour)),
    ])
    return {
      run,
      segments: new Map(segments.filter((s): s is Segment => !!s).map((s) => [s.id, s])),
      texts: new Map(texts.filter((t): t is TextItem => !!t).map((t) => [t.id, t])),
      readingMsToday: today?.readingMs ?? 0,
    }
  }, [runId, dayStartHour])
}
