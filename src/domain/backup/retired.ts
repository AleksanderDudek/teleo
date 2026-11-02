import type { AchievementRow, SessionRun, SessionTemplate, TaskLogRow, TaskRow, TextStats } from '@/db/types'
import type { BackupData } from './validate'

/*
 * Rows of features and content that left Teleo.
 * - Language dialogues (DECISIONS #118) moved to their own app, Fluentum (#117): each was a hidden text
 *   `source: 'dialogue'` (`dialogue:<lang>:<key>`) with its segments, text stats and runs.
 * - The Hail Mary and the rosary decades built on it (#135): builtin texts and sessions taken out of the content.
 * Nothing here can show or play them any more, so the Dexie upgrades delete them (v4, v7) and every restore drops them
 * from older backups and restore points. Attempts, daily stats and the XP ledger stay — points and streak days earned
 * are kept, the same rule as deleting a user text (#28).
 */

/** `source` values of texts no feature uses any more; older backups may still hold them. */
export const RETIRED_TEXT_SOURCES = ['dialogue'] as const

/** Keys of builtin texts and sessions taken out of the content (#135). */
export const RETIRED_BUILTIN_TEXTS = ['pl.zdrowas-maryjo', 'en.hail-mary'] as const
export const RETIRED_BUILTIN_SESSIONS = ['pl.dziesiatka-rozanca', 'en.decade-of-the-rosary'] as const

const isRetiredBuiltin = (keys: readonly string[], row: { source: string; builtinKey?: string }) =>
  row.source === 'builtin' && row.builtinKey !== undefined && keys.includes(row.builtinKey)

export function isRetiredText(text: { source: string; builtinKey?: string }): boolean {
  return (RETIRED_TEXT_SOURCES as readonly string[]).includes(text.source) || isRetiredBuiltin(RETIRED_BUILTIN_TEXTS, text)
}

export const isRetiredTemplate = (template: Pick<SessionTemplate, 'source' | 'builtinKey'>): boolean =>
  isRetiredBuiltin(RETIRED_BUILTIN_SESSIONS, template)

/** The retired texts among `texts`, and which rows of the other tables belong to them. */
export function retiredRows(texts: ReadonlyArray<{ id: string; source: string; builtinKey?: string }>) {
  const textIds: ReadonlySet<string> = new Set(texts.filter(isRetiredText).map((text) => text.id))
  const ofRetired = (textId: string | undefined) => textId !== undefined && textIds.has(textId)
  return {
    textIds,
    text: (row: { id: string }) => textIds.has(row.id),
    segment: (row: { textId: string }) => ofRetired(row.textId),
    textStats: (row: Pick<TextStats, 'textId'>) => ofRetired(row.textId),
    /** Per-text achievements only (global ones have no `textId`). */
    achievement: (row: Pick<AchievementRow, 'textId'>) => ofRetired(row.textId),
    /**
     * A run of a retired text could never be resumed or repeated (it was played by `textId`, DECISIONS #104), nor an
     * unfinished session run that holds one. Finished session runs stay in the history.
     */
    sessionRun: (row: Pick<SessionRun, 'textId' | 'status' | 'plan'>) =>
      ofRetired(row.textId) || (row.status !== 'completed' && row.plan.some((entry) => ofRetired(entry.textId))),
    task: (row: Pick<TaskRow, 'textId'>) => ofRetired(row.textId),
    /** `template` without the retired texts — the same object when it holds none (#28: a deleted text leaves them). */
    template: <T extends Pick<SessionTemplate, 'items'>>(template: T): T =>
      template.items.some((item) => ofRetired(item.textId))
        ? { ...template, items: template.items.filter((item) => !ofRetired(item.textId)) }
        : template,
  }
}

/** The task log without the entries of `tasks` that are dropped. */
const logOfKept = (log: readonly TaskLogRow[], dropped: readonly TaskRow[]) => {
  const ids = new Set(dropped.map((task) => task.id))
  return log.filter((row) => !ids.has(row.taskId))
}

/** `data` without the rows of retired texts and sessions — unchanged (the same object) when it holds none. */
export function withoutRetiredRows(data: BackupData): BackupData {
  const retired = retiredRows(data.texts)
  if (retired.textIds.size === 0 && !data.sessionTemplates.some(isRetiredTemplate)) return data
  const droppedTasks = (data.tasks ?? []).filter(retired.task)
  return {
    ...data,
    texts: data.texts.filter((row) => !retired.text(row)),
    segments: data.segments.filter((row) => !retired.segment(row)),
    sessionTemplates: data.sessionTemplates.filter((row) => !isRetiredTemplate(row)).map(retired.template),
    textStats: data.textStats.filter((row) => !retired.textStats(row)),
    achievements: data.achievements.filter((row) => !retired.achievement(row)),
    sessionRuns: data.sessionRuns.filter((row) => !retired.sessionRun(row)),
    ...(data.tasks ? { tasks: data.tasks.filter((row) => !retired.task(row)) } : {}),
    ...(data.taskLog ? { taskLog: logOfKept(data.taskLog, droppedTasks) } : {}),
  }
}
