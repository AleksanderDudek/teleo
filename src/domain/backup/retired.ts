import type { AchievementRow, SessionRun, TextStats } from '@/db/types'
import type { BackupData } from './validate'

/*
 * Rows of features that left Teleo (DECISIONS #118). Language dialogues moved to their own app, Fluentum (#117):
 * each was a hidden text `source: 'dialogue'` (`dialogue:<lang>:<key>`) with its segments, text stats and runs.
 * Nothing here can show or play them any more, so the v4 upgrade deletes them and every restore drops them from
 * older backups and restore points. Attempts, daily stats and the XP ledger stay — points and streak days earned
 * are kept, the same rule as deleting a user text (#28).
 */

/** `source` values of texts no feature uses any more; older backups may still hold them. */
export const RETIRED_TEXT_SOURCES = ['dialogue'] as const

export function isRetiredText(text: { source: string }): boolean {
  return (RETIRED_TEXT_SOURCES as readonly string[]).includes(text.source)
}

/** The retired texts among `texts`, and which rows of the other tables belong to them. */
export function retiredRows(texts: ReadonlyArray<{ id: string; source: string }>) {
  const textIds: ReadonlySet<string> = new Set(texts.filter(isRetiredText).map((text) => text.id))
  const ofRetired = (textId: string | undefined) => textId !== undefined && textIds.has(textId)
  return {
    textIds,
    text: (row: { id: string }) => textIds.has(row.id),
    segment: (row: { textId: string }) => ofRetired(row.textId),
    textStats: (row: Pick<TextStats, 'textId'>) => ofRetired(row.textId),
    /** Per-text achievements only (global ones have no `textId`). */
    achievement: (row: Pick<AchievementRow, 'textId'>) => ofRetired(row.textId),
    /** A run of a retired text could never be resumed or repeated (it was played by `textId`, DECISIONS #104). */
    sessionRun: (row: Pick<SessionRun, 'textId'>) => ofRetired(row.textId),
  }
}

/** `data` without the rows of retired texts — unchanged (the same object) when it holds none. */
export function withoutRetiredRows(data: BackupData): BackupData {
  const retired = retiredRows(data.texts)
  if (retired.textIds.size === 0) return data
  return {
    ...data,
    texts: data.texts.filter((row) => !retired.text(row)),
    segments: data.segments.filter((row) => !retired.segment(row)),
    textStats: data.textStats.filter((row) => !retired.textStats(row)),
    achievements: data.achievements.filter((row) => !retired.achievement(row)),
    sessionRuns: data.sessionRuns.filter((row) => !retired.sessionRun(row)),
  }
}
