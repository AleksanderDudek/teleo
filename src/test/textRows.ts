import type { AchievementRow, Attempt, Segment, SessionRun, TextItem, TextStats, XpLedgerRow } from '@/db/types'
import type { BackupData } from '@/domain/backup'
import type { Lang } from '@/domain/types'

export interface TextRows {
  text: TextItem
  segments: Segment[]
  textStats: TextStats
  run: SessionRun
  attempt: Attempt
  achievement: AchievementRow
  xp: XpLedgerRow
}

/**
 * The rows saying one text leaves behind: the text, its two segments, its stats, a finished run of it, an attempt,
 * a per-text achievement and the points of that attempt. `source: 'dialogue'` is how language dialogues were stored
 * before they moved to their own app (DECISIONS #117) — no longer a `TextItem` source, hence the cast.
 */
export function textRows(id: string, source: TextItem['source'] | 'dialogue', lang: Lang = 'pl'): TextRows {
  const dayKey = '2026-09-30'
  const at = new Date(2026, 8, 30, 12).getTime()
  const text = {
    id,
    title: `Title of ${id}`,
    type: 'text',
    lang,
    body: 'First line. Second line.',
    source,
    tags: [],
    archived: false,
    splitMode: 'sentence',
    createdAt: at,
    updatedAt: at,
  } as unknown as TextItem
  const segments: Segment[] = ['First line.', 'Second line.'].map((content, order) => ({
    id: `${id}#${order}`,
    textId: id,
    order,
    content,
    wordCount: 2,
    archived: false,
  }))
  const run: SessionRun = {
    id: `run:${id}`,
    textId: id,
    title: text.title,
    dayKey,
    startedAt: at,
    endedAt: at + 60_000,
    status: 'completed',
    plan: segments.map((segment) => ({ segmentId: segment.id, textId: id, block: 0, fullText: true, item: 0 })),
    entries: segments.map(() => ({ status: 'accepted', attempts: 1, firstTry: true, xp: 10 })),
    cursor: segments.length,
    xpEarned: 20,
    lastActivityAt: at + 60_000,
    mode: 'read',
  }
  const attempt: Attempt = {
    id: `attempt:${id}`,
    segmentId: segments[0]!.id,
    textId: id,
    sessionRunId: run.id,
    dayKey,
    timestamp: at + 1_000,
    coverage: 1,
    extra: 0,
    wrong: 0,
    accepted: true,
    firstTry: true,
    threshold: 0.9,
    engine: 'webspeech',
    durationMs: 900,
  }
  return {
    text,
    segments,
    textStats: {
      textId: id,
      repetitions: 1,
      segmentsAccepted: 2,
      currentDayStreak: 1,
      bestDayStreak: 1,
      lastDayKey: dayKey,
      perfectRuns: 1,
      consecutiveFirstTry: 2,
      bestConsecutiveFirstTry: 2,
      memoryRuns: 0,
    },
    run,
    attempt,
    achievement: { key: `text.perfect:${id}`, ruleId: 'text.perfect', textId: id, tier: 'silver', xp: 10, unlockedAt: at + 60_000 },
    xp: { timestamp: at + 1_000, dayKey, reason: 'segment', amount: 10, refId: attempt.id },
  }
}

/** The rows a language dialogue (`dialogue:<lang>:<key>`) left on a device or in a backup. */
export function dialogueRows(key = 'cafe', lang: Lang = 'en'): TextRows {
  return textRows(`dialogue:${lang}:${key}`, 'dialogue', lang)
}

/** `data` with the rows of more texts added to its tables. */
export function withTextRows(data: BackupData, ...rows: TextRows[]): BackupData {
  return {
    ...data,
    texts: [...data.texts, ...rows.map((r) => r.text)],
    segments: [...data.segments, ...rows.flatMap((r) => r.segments)],
    textStats: [...data.textStats, ...rows.map((r) => r.textStats)],
    sessionRuns: [...data.sessionRuns, ...rows.map((r) => r.run)],
    attempts: [...data.attempts, ...rows.map((r) => r.attempt)],
    achievements: [...data.achievements, ...rows.map((r) => r.achievement)],
    xpLedger: [...data.xpLedger, ...rows.map((r) => r.xp)],
  }
}
