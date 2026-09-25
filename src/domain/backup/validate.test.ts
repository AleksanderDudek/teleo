import { describe, expect, it } from 'vitest'
import {
  BACKUP_APP,
  BACKUP_SCHEMA_VERSION,
  createBackupFile,
  parseBackup,
  validateBackup,
} from './validate'
import type { BackupData, BackupFile } from './validate'

function emptyData(): BackupData {
  return {
    texts: [],
    segments: [],
    sessionTemplates: [],
    sessionRuns: [],
    attempts: [],
    dailyStats: [],
    textStats: [],
    achievements: [],
    xpLedger: [],
    settings: [],
  }
}

function realisticData(): BackupData {
  return {
    texts: [
      {
        id: 't1',
        title: 'Ojcze nasz',
        body: 'Ojcze nasz, któryś jest w niebie...',
        type: 'prayer',
        lang: 'pl',
        source: 'builtin',
        tags: ['classic'],
        archived: false,
        splitMode: 'sentence',
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    segments: [
      {
        id: 's1',
        textId: 't1',
        content: 'Ojcze nasz, któryś jest w niebie.',
        order: 0,
        wordCount: 6,
        archived: false,
      },
    ],
    sessionTemplates: [
      {
        id: 'st1',
        name: 'Rosary',
        pinned: true,
        archived: false,
        items: [{ textId: 't1', repeat: 1 }],
        createdAt: 1,
        updatedAt: 2,
        source: 'builtin',
      },
    ],
    sessionRuns: [
      {
        id: 'sr1',
        dayKey: '2026-09-25',
        title: 'Morning',
        status: 'completed',
        plan: [{ segmentId: 's1', textId: 't1', block: 0, fullText: true }],
        entries: [{ status: 'accepted', attempts: 1, firstTry: true, xp: 5 }],
        cursor: 1,
        startedAt: 1000,
        xpEarned: 5,
        lastActivityAt: 1000,
        mode: 'read',
      },
    ],
    attempts: [
      {
        id: 'a1',
        segmentId: 's1',
        textId: 't1',
        sessionRunId: 'sr1',
        dayKey: '2026-09-25',
        timestamp: 1000,
        coverage: 1,
        extra: 0,
        wrong: 0,
        accepted: true,
        firstTry: true,
        strictness: 'strict',
        engine: 'webspeech',
        durationMs: 500,
      },
    ],
    dailyStats: [
      {
        dayKey: '2026-09-25',
        segmentsAccepted: 1,
        attempts: 1,
        textsCompleted: 0,
        sessionsCompleted: 0,
        xp: 5,
        langs: ['pl'],
        goalReached: false,
        frozen: false,
        morning: true,
        evening: false,
        firstTryAccepted: 1,
      },
    ],
    textStats: [
      {
        textId: 't1',
        repetitions: 1,
        segmentsAccepted: 1,
        currentDayStreak: 1,
        bestDayStreak: 1,
        perfectRuns: 0,
        consecutiveFirstTry: 1,
        bestConsecutiveFirstTry: 1,
        memoryRuns: 0,
      },
    ],
    achievements: [{ key: 'k1', ruleId: 'r1', tier: 'bronze', xp: 10, unlockedAt: 1000 }],
    xpLedger: [{ timestamp: 1000, dayKey: '2026-09-25', reason: 'segment', amount: 5 }],
    settings: [{ key: 'meta', value: { schemaVersion: 1, seedVersion: 1, installedAt: 1000 } }],
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('validateBackup', () => {
  it('accepts a minimal backup with every table empty', () => {
    const backup: BackupFile = {
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: emptyData(),
    }
    const result = validateBackup(cloneJson(backup))
    expect(result.ok).toBe(true)
  })

  it('accepts a realistic row in every table', () => {
    const backup: BackupFile = {
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: realisticData(),
    }
    const result = validateBackup(cloneJson(backup))
    if (!result.ok) throw new Error(`expected ok, got ${result.code}`)
    expect(result.backup.data.texts).toHaveLength(1)
    expect(result.backup.data.xpLedger).toHaveLength(1)
  })

  it('rejects a value that is not an object', () => {
    const result = validateBackup(42)
    expect(result).toEqual({ ok: false, code: 'invalidShape' })
  })

  it('rejects the wrong app', () => {
    const backup = { app: 'other', schemaVersion: 1, exportedAt: 1, data: emptyData() }
    const result = validateBackup(backup)
    expect(result).toEqual({ ok: false, code: 'wrongApp' })
  })

  it.each([0, 2])('rejects unsupported schema version %i', (schemaVersion) => {
    const backup = { app: BACKUP_APP, schemaVersion, exportedAt: 1, data: emptyData() }
    const result = validateBackup(backup)
    expect(result).toEqual({ ok: false, code: 'unsupportedVersion' })
  })

  it('rejects a missing table with a path pointing at it', () => {
    const backup = cloneJson({
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: emptyData(),
    })
    delete (backup.data as unknown as Record<string, unknown>).xpLedger

    const result = validateBackup(backup)
    expect(result).toEqual({ ok: false, code: 'invalidShape', path: 'data.xpLedger' })
  })

  it('rejects a bad enum value with a path to the offending field', () => {
    const backup = cloneJson({
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: realisticData(),
    })
    // @ts-expect-error -- intentionally corrupting the fixture to test validation
    backup.data.texts[0].lang = 'de'

    const result = validateBackup(backup)
    expect(result).toEqual({ ok: false, code: 'invalidShape', path: 'data.texts[0].lang' })
  })

  it('rejects a sessionRun whose plan and entries lengths differ', () => {
    const backup = cloneJson({
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: realisticData(),
    })
    backup.data.sessionRuns[0]!.entries = []

    const result = validateBackup(backup)
    if (result.ok) throw new Error('expected validation to fail')
    expect(result.code).toBe('invalidShape')
    expect(result.path).toBe('data.sessionRuns[0].entries')
  })
})

describe('parseBackup', () => {
  it('reports notJson for malformed JSON', () => {
    const result = parseBackup('not json{')
    expect(result).toEqual({ ok: false, code: 'notJson' })
  })

  it('parses and validates well-formed JSON', () => {
    const backup: BackupFile = {
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: emptyData(),
    }
    const result = parseBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
  })
})

describe('createBackupFile', () => {
  it('round-trips through JSON and validation', () => {
    const data = realisticData()
    const created = createBackupFile(data, 12345)

    expect(created.app).toBe(BACKUP_APP)
    expect(created.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(created.exportedAt).toBe(12345)

    const result = parseBackup(JSON.stringify(created))
    if (!result.ok) throw new Error(`expected ok, got ${result.code}`)
    expect(result.backup).toEqual(created)
  })
})
