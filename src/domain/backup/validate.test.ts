import { describe, expect, it } from 'vitest'
import { BACKUP_APP, BACKUP_SCHEMA_VERSION, createBackupFile, parseBackup, validateBackup } from './validate'
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
        plan: [{ segmentId: 's1', textId: 't1', block: 0, fullText: true, item: 0 }],
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
        threshold: 0.9,
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
    bibleReadings: [{ readingId: 'kjv.GEN.0', translation: 'kjv', book: 'GEN', index: 0, ofBook: 60, completedAt: 1000, dayKey: '2026-09-25', skipped: 0 }],
    friends: [
      {
        v: 1,
        id: 'abc123',
        name: 'Jan',
        character: 'jan',
        at: 900,
        streak: 2,
        day: { k: '2026-09-25', p: 40 },
        week: { k: '2026-09-21', p: 120 },
        month: { k: '2026-09', p: 400 },
        receivedAt: 950,
      },
    ],
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function backupWith(data: BackupData): unknown {
  return cloneJson({ app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 1000, data })
}

describe('validateBackup: tables added later (v1.3)', () => {
  const reading = { readingId: 'kjv.GEN.1', translation: 'kjv', book: 'GEN', index: 0, ofBook: 64, completedAt: 1000, dayKey: '2026-09-27', skipped: 0 }
  const friend = {
    v: 1,
    id: 'f7c1a2b3',
    name: 'Michał',
    character: 'michal',
    at: 1000,
    streak: 3,
    day: { k: '2026-09-27', p: 10 },
    week: { k: '2026-09-21', p: 50 },
    month: { k: '2026-09', p: 90 },
    receivedAt: 2000,
  }

  it('reads backups made before they existed as empty', () => {
    const result = validateBackup(backupWith(emptyData()))
    expect(result.ok && result.backup.data.bibleReadings).toEqual([])
    expect(result.ok && result.backup.data.friends).toEqual([])
  })

  it('accepts valid Bible readings and friends', () => {
    const result = validateBackup(backupWith({ ...emptyData(), bibleReadings: [reading], friends: [friend] } as BackupData))
    expect(result.ok).toBe(true)
  })

  it('rejects malformed rows with a precise path', () => {
    const badReading = validateBackup(backupWith({ ...emptyData(), bibleReadings: [{ ...reading, translation: 'nrsv' }] } as unknown as BackupData))
    expect(badReading).toEqual({ ok: false, code: 'invalidShape', path: 'data.bibleReadings[0].translation' })
    const badFriend = validateBackup(backupWith({ ...emptyData(), friends: [{ ...friend, week: { k: 3 } }] } as unknown as BackupData))
    expect(badFriend).toMatchObject({ ok: false, path: 'data.friends[0].week.k' })
    const notArray = validateBackup(backupWith({ ...emptyData(), friends: {} } as unknown as BackupData))
    expect(notArray).toEqual({ ok: false, code: 'invalidShape', path: 'data.friends' })
  })
})

describe('validateBackup: acceptance', () => {
  it('accepts a minimal backup with every table empty', () => {
    const result = validateBackup(backupWith(emptyData()))
    expect(result.ok).toBe(true)
  })

  it('accepts a realistic row in every table', () => {
    const result = validateBackup(backupWith(realisticData()))
    if (!result.ok) throw new Error(`expected ok, got ${result.code}${result.path ? ` @ ${result.path}` : ''}`)
    expect(result.backup.data.texts).toHaveLength(1)
    expect(result.backup.data.xpLedger).toHaveLength(1)
  })

  it('allows unknown extra fields on a row (forward compatibility)', () => {
    const data = realisticData()
    data.texts = [{ ...data.texts[0]!, futureField: 'added in a later schema version' } as (typeof data.texts)[number]]
    const result = validateBackup(backupWith(data))
    expect(result.ok).toBe(true)
  })

  it('accepts cursor at the inclusive bounds 0 and plan.length', () => {
    const atStart = realisticData()
    atStart.sessionRuns[0]!.cursor = 0
    expect(validateBackup(backupWith(atStart)).ok).toBe(true)

    const atEnd = realisticData()
    atEnd.sessionRuns[0]!.cursor = atEnd.sessionRuns[0]!.plan.length
    expect(validateBackup(backupWith(atEnd)).ok).toBe(true)
  })

  it('accepts xpLedger.id when present and finite', () => {
    const data = realisticData()
    data.xpLedger[0] = { ...data.xpLedger[0]!, id: 42 }
    expect(validateBackup(backupWith(data)).ok).toBe(true)
  })

  it('accepts a full AppSettings settings row', () => {
    const data = realisticData()
    data.settings = [
      {
        key: 'app',
        value: {
          uiLang: 'pl',
          theme: 'system',
          engine: 'auto',
          whisperModel: 'tiny',
          dayStartHour: 3,
          dailyGoal: 20,
          handsFree: false,
          saveTranscripts: true,
          fontSize: 'md',
          listenFirst: false,
          grammaticalForm: 'm',
          contentFocus: 'both',
          reminderTime: '07:00',
          onboardingCompleted: true,
          speechPrivacyAcknowledged: true,
          character: 'michal',
          sounds: true,
          displayName: '',
        },
      },
    ]
    expect(validateBackup(backupWith(data)).ok).toBe(true)
  })

  it('accepts attempts exported before the coverage ladder (a strictness, no threshold)', () => {
    const data = realisticData()
    const { threshold: _threshold, ...rest } = data.attempts[0]!
    data.attempts = [{ ...rest, strictness: 'strict' } as never]
    expect(validateBackup(backupWith(data)).ok).toBe(true)
  })

  it('accepts AppSettings exported before characters existed', () => {
    const data = realisticData()
    const legacy = {
      uiLang: 'en',
      theme: 'dark',
      engine: 'webspeech',
      whisperModel: 'base',
      strictness: 'lenient',
      dayStartHour: 0,
      dailyGoal: 5,
      handsFree: true,
      saveTranscripts: false,
      fontSize: 'lg',
      listenFirst: true,
      grammaticalForm: 'f',
      contentFocus: 'prayers',
      reminderTime: '21:30',
      onboardingCompleted: true,
      speechPrivacyAcknowledged: false,
    }
    data.settings = [{ key: 'app', value: legacy as never }]
    expect(validateBackup(backupWith(data)).ok).toBe(true)
  })

  it('accepts a full GameState settings row', () => {
    const data = realisticData()
    data.settings = [
      {
        key: 'game',
        value: {
          freezesAvailable: 1,
          lastFreezeAwardStreak: 0,
          perfectSessions: 0,
          fullSessions: 0,
          comebacks: 0,
          totalXp: 0,
          pendingFreezeNotice: ['2026-09-24'],
        },
      },
    ]
    expect(validateBackup(backupWith(data)).ok).toBe(true)
  })
})

describe('validateBackup: top-level rejection', () => {
  it('rejects a value that is not an object', () => {
    expect(validateBackup(42)).toEqual({ ok: false, code: 'invalidShape' })
  })

  it('rejects the wrong app', () => {
    const backup = { app: 'other', schemaVersion: 1, exportedAt: 1, data: emptyData() }
    expect(validateBackup(backup)).toEqual({ ok: false, code: 'wrongApp' })
  })

  it.each([0, 2])('rejects unsupported schema version %i', (schemaVersion) => {
    const backup = { app: BACKUP_APP, schemaVersion, exportedAt: 1, data: emptyData() }
    expect(validateBackup(backup)).toEqual({ ok: false, code: 'unsupportedVersion' })
  })

  it('rejects a non-finite exportedAt', () => {
    const backup = { app: BACKUP_APP, schemaVersion: 1, exportedAt: Number.POSITIVE_INFINITY, data: emptyData() }
    expect(validateBackup(backup)).toEqual({ ok: false, code: 'invalidShape', path: 'exportedAt' })
  })

  it('rejects a non-object `data`', () => {
    const backup = { app: BACKUP_APP, schemaVersion: 1, exportedAt: 1, data: [] }
    expect(validateBackup(backup)).toEqual({ ok: false, code: 'invalidShape', path: 'data' })
  })

  it('rejects a missing table with a path pointing at it', () => {
    const backup = backupWith(emptyData()) as Record<string, unknown>
    delete (backup.data as Record<string, unknown>).xpLedger
    expect(validateBackup(backup)).toEqual({ ok: false, code: 'invalidShape', path: 'data.xpLedger' })
  })

  it('rejects a null row', () => {
    const data = realisticData()
    ;(data.texts as unknown[])[0] = null
    expect(validateBackup(backupWith(data))).toEqual({
      ok: false,
      code: 'invalidShape',
      path: 'data.texts[0]',
    })
  })

  it('rejects an array standing in for a row', () => {
    const data = realisticData()
    ;(data.texts as unknown[])[0] = ['not', 'a', 'row']
    expect(validateBackup(backupWith(data))).toEqual({
      ok: false,
      code: 'invalidShape',
      path: 'data.texts[0]',
    })
  })
})

describe('validateBackup: per-table field rejection', () => {
  type Mutation = { name: string; path: string; mutate: (data: BackupData) => void }

  const mutations: Mutation[] = [
    {
      name: 'texts: bad lang enum',
      path: 'data.texts[0].lang',
      mutate: (d) => {
        d.texts[0] = { ...d.texts[0]!, lang: 'de' as never }
      },
    },
    {
      name: 'segments: wordCount not a number',
      path: 'data.segments[0].wordCount',
      mutate: (d) => {
        d.segments[0] = { ...d.segments[0]!, wordCount: 'six' as never }
      },
    },
    {
      name: 'sessionTemplates: nested items[1].repeat',
      path: 'data.sessionTemplates[0].items[1].repeat',
      mutate: (d) => {
        d.sessionTemplates[0]!.items = [
          { textId: 't1', repeat: 1 },
          { textId: 't1', repeat: 'lots' as never },
        ]
      },
    },
    {
      name: 'sessionRuns: plan[0].block negative',
      path: 'data.sessionRuns[0].plan[0].block',
      mutate: (d) => {
        d.sessionRuns[0]!.plan[0]!.block = -1
      },
    },
    {
      name: 'sessionRuns: plan[0].item negative',
      path: 'data.sessionRuns[0].plan[0].item',
      mutate: (d) => {
        d.sessionRuns[0]!.plan[0]!.item = -1
      },
    },
    {
      name: 'sessionRuns: entries[0].status bad enum',
      path: 'data.sessionRuns[0].entries[0].status',
      mutate: (d) => {
        d.sessionRuns[0]!.entries[0] = { ...d.sessionRuns[0]!.entries[0]!, status: 'done' as never }
      },
    },
    {
      name: 'sessionRuns: cursor beyond plan.length',
      path: 'data.sessionRuns[0].cursor',
      mutate: (d) => {
        d.sessionRuns[0]!.cursor = 99
      },
    },
    {
      name: 'attempts: threshold not a number',
      path: 'data.attempts[0].threshold',
      mutate: (d) => {
        d.attempts[0] = { ...d.attempts[0]!, threshold: 'high' as never }
      },
    },
    {
      name: 'dailyStats: dayKey not YYYY-MM-DD',
      path: 'data.dailyStats[0].dayKey',
      mutate: (d) => {
        d.dailyStats[0] = { ...d.dailyStats[0]!, dayKey: '2026/09/25' as never }
      },
    },
    {
      name: 'textStats: counter not finite',
      path: 'data.textStats[0].bestConsecutiveFirstTry',
      mutate: (d) => {
        d.textStats[0] = { ...d.textStats[0]!, bestConsecutiveFirstTry: 'nope' as never }
      },
    },
    {
      name: 'achievements: bad tier enum',
      path: 'data.achievements[0].tier',
      mutate: (d) => {
        d.achievements[0] = { ...d.achievements[0]!, tier: 'copper' as never }
      },
    },
    {
      name: 'xpLedger: bad reason enum',
      path: 'data.xpLedger[0].reason',
      mutate: (d) => {
        d.xpLedger[0] = { ...d.xpLedger[0]!, reason: 'bonus' as never }
      },
    },
    {
      name: 'xpLedger: id present but not finite',
      path: 'data.xpLedger[0].id',
      mutate: (d) => {
        d.xpLedger[0] = { ...d.xpLedger[0]!, id: 'abc' as never }
      },
    },
    {
      name: 'settings: bad key',
      path: 'data.settings[0].key',
      mutate: (d) => {
        d.settings[0] = { key: 'bogus', value: {} } as unknown as (typeof d.settings)[number]
      },
    },
    {
      name: 'settings: unknown character',
      path: 'data.settings[0].value.character',
      mutate: (d) => {
        d.settings[0] = {
          key: 'app',
          value: {
            uiLang: 'pl',
            theme: 'system',
            engine: 'auto',
            whisperModel: 'tiny',
            dayStartHour: 3,
            dailyGoal: 20,
            handsFree: false,
            saveTranscripts: true,
            fontSize: 'md',
            listenFirst: false,
            grammaticalForm: 'm',
            contentFocus: 'both',
            reminderTime: '07:00',
            onboardingCompleted: true,
            speechPrivacyAcknowledged: true,
            character: 'zeus' as never,
            sounds: true,
            displayName: '',
          },
        }
      },
    },
    {
      name: 'settings: bad field inside an app settings value',
      path: 'data.settings[0].value.theme',
      mutate: (d) => {
        d.settings[0] = {
          key: 'app',
          value: {
            uiLang: 'pl',
            theme: 'purple' as never,
            engine: 'auto',
            whisperModel: 'tiny',
            dayStartHour: 3,
            dailyGoal: 20,
            handsFree: false,
            saveTranscripts: true,
            fontSize: 'md',
            listenFirst: false,
            grammaticalForm: 'm',
            contentFocus: 'both',
            reminderTime: '07:00',
            onboardingCompleted: true,
            speechPrivacyAcknowledged: true,
            character: 'anna',
            sounds: true,
            displayName: '',
          },
        }
      },
    },
  ]

  it.each(mutations)('$name -> $path', ({ mutate, path }) => {
    const data = realisticData()
    mutate(data)
    expect(validateBackup(backupWith(data))).toEqual({ ok: false, code: 'invalidShape', path })
  })

  it('rejects a sessionRun whose plan and entries lengths differ', () => {
    const data = realisticData()
    data.sessionRuns[0]!.entries = []
    expect(validateBackup(backupWith(data))).toEqual({
      ok: false,
      code: 'invalidShape',
      path: 'data.sessionRuns[0].entries',
    })
  })
})

describe('parseBackup', () => {
  it('reports notJson for malformed JSON', () => {
    expect(parseBackup('not json{')).toEqual({ ok: false, code: 'notJson' })
  })

  it('parses and validates well-formed JSON', () => {
    const backup: BackupFile = {
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: 1000,
      data: emptyData(),
    }
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(true)
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
