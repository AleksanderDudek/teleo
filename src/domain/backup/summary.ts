import type { BackupData } from './validate'

/** What a backup (or this device) holds, in the terms a person would miss it (DECISIONS #112). */
export interface BackupSummary {
  /** Sentences said (accepted). */
  sentences: number
  /** Days with at least one sentence said. */
  activeDays: number
  lastActiveDay?: string
  /** Points from the XP ledger (the source of truth; the cached total follows it). */
  xp: number
  /** The user's own texts. */
  ownTexts: number
  achievements: number
  bibleReadings: number
}

export type SummarySource = Pick<BackupData, 'dailyStats' | 'texts' | 'xpLedger' | 'achievements'> & Partial<Pick<BackupData, 'bibleReadings'>>

export function summarizeBackup(data: SummarySource): BackupSummary {
  const active = data.dailyStats.filter((day) => day.segmentsAccepted > 0)
  return {
    sentences: data.dailyStats.reduce((sum, day) => sum + day.segmentsAccepted, 0),
    activeDays: active.length,
    lastActiveDay: active.map((day) => day.dayKey).sort().at(-1),
    xp: data.xpLedger.reduce((sum, row) => sum + row.amount, 0),
    ownTexts: data.texts.filter((text) => text.source === 'user').length,
    achievements: data.achievements.length,
    bibleReadings: data.bibleReadings?.length ?? 0,
  }
}

/** Anything worth keeping: something said, earned or written. */
export function hasProgress(summary: BackupSummary): boolean {
  return summary.sentences > 0 || summary.xp > 0 || summary.ownTexts > 0 || summary.achievements > 0
}

/**
 * Would restoring `file` over `device` lose something? `older`: the file ends before the last active day here;
 * `lessProgress`: it holds fewer sentences, points or own texts. A device without progress never warns.
 */
export function compareSummaries(file: BackupSummary, device: BackupSummary): { older: boolean; lessProgress: boolean } {
  if (!hasProgress(device)) return { older: false, lessProgress: false }
  const older = device.lastActiveDay !== undefined && (file.lastActiveDay === undefined || file.lastActiveDay < device.lastActiveDay)
  const lessProgress = file.sentences < device.sentences || file.xp < device.xp || file.ownTexts < device.ownTexts
  return { older, lessProgress }
}
