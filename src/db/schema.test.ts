import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { dialogueRows, retiredBuiltinRows, textRows, type TextRows } from '@/test/textRows'
import { SCHEMA_VERSION, TeleoDB } from './schema'

const NAME = 'teleo-upgrade-test'

/** The database as version 3 left it: the stores of v1–v3, exactly as `TeleoDB` declared them then. */
function openVersion3(): Dexie {
  const old = new Dexie(NAME)
  old.version(1).stores({
    texts: 'id, lang, type, source, updatedAt',
    segments: 'id, textId, [textId+order]',
    sessionTemplates: 'id, updatedAt',
    sessionRuns: 'id, templateId, dayKey, startedAt, status',
    attempts: 'id, segmentId, textId, sessionRunId, dayKey, timestamp',
    dailyStats: 'dayKey',
    textStats: 'textId',
    achievements: 'key, ruleId, textId, unlockedAt',
    xpLedger: '++id, timestamp, reason',
    settings: 'key',
  })
  old.version(2).stores({ bibleReadings: 'readingId, [translation+book], dayKey', friends: 'id' })
  old.version(3).stores({ restorePoints: 'key' })
  return old
}

async function store(old: Dexie, ...all: TextRows[]): Promise<void> {
  await old.table('texts').bulkAdd(all.map((r) => r.text))
  await old.table('segments').bulkAdd(all.flatMap((r) => r.segments))
  await old.table('textStats').bulkAdd(all.map((r) => r.textStats))
  await old.table('sessionRuns').bulkAdd(all.map((r) => r.run))
  await old.table('attempts').bulkAdd(all.map((r) => r.attempt))
  await old.table('achievements').bulkAdd(all.map((r) => r.achievement))
  await old.table('xpLedger').bulkAdd(all.map((r) => r.xp))
}

const byId = <T extends { id?: unknown }>(rows: T[]) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)))

afterEach(async () => {
  await Dexie.delete(NAME)
})

describe('schema version 4: language dialogues left Teleo (DECISIONS #118)', () => {
  it('deletes the rows dialogues left and keeps everything else, the progress earned with them included', async () => {
    const cafe = dialogueRows('cafe', 'en')
    const station = dialogueRows('station', 'pl')
    const own = textRows('own', 'user')
    const bible = textRows('bible:kjv.GEN.0', 'bible', 'en')
    const day = { dayKey: '2026-09-30', segmentsAccepted: 8, attempts: 8, textsCompleted: 4, sessionsCompleted: 4, xp: 80, langs: ['en', 'pl'], goalReached: true, frozen: false, morning: false, evening: false, firstTryAccepted: 8 }
    const streakAchievement = { key: 'streak.2', ruleId: 'streak.2', tier: 'bronze', xp: 50, unlockedAt: 1 }

    const old = openVersion3()
    await store(old, cafe, own, station, bible)
    await old.table('dailyStats').add(day)
    await old.table('achievements').add(streakAchievement)
    const ledger = await old.table('xpLedger').toArray()
    old.close()

    const db = new TeleoDB(NAME)
    await db.open()
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(7)

    expect(byId(await db.texts.toArray())).toEqual(byId([bible.text, own.text]))
    expect(await db.segments.orderBy('id').toArray()).toEqual(byId([...bible.segments, ...own.segments]))
    expect(await db.textStats.orderBy('textId').toArray()).toEqual([bible.textStats, own.textStats])
    expect(byId(await db.sessionRuns.toArray())).toEqual(byId([bible.run, own.run]))
    expect(await db.achievements.orderBy('key').toArray()).toEqual([streakAchievement, bible.achievement, own.achievement])
    // What was earned stays: every attempt, the day and its points.
    expect(byId(await db.attempts.toArray())).toEqual(byId([cafe.attempt, own.attempt, station.attempt, bible.attempt]))
    expect(await db.dailyStats.toArray()).toEqual([day])
    expect(await db.xpLedger.toArray()).toEqual(ledger)
    db.close()
  })

  it('adds the daily-task tables (v5) to a database upgraded from v3 without touching its rows', async () => {
    const own = textRows('own', 'user')
    const old = openVersion3()
    await store(old, own)
    old.close()

    const db = new TeleoDB(NAME)
    await db.open()
    expect(await db.tasks.count()).toBe(0)
    expect(await db.taskLog.count()).toBe(0)
    await db.tasks.add({ id: 'task1', textId: own.text.id, timesPerDay: 3, startDay: '2026-10-05', endDay: '2026-10-18', createdAt: 1, archived: false })
    await db.taskLog.add({ id: 'log1', taskId: 'task1', dayKey: '2026-10-05', runId: own.run.id, timestamp: 2 })
    expect(await db.taskLog.where('[taskId+dayKey]').equals(['task1', '2026-10-05']).count()).toBe(1)
    expect(await db.texts.toArray()).toEqual([own.text])
    db.close()
  })

  it('leaves a database without dialogues as it was', async () => {
    const own = textRows('own', 'user')
    const old = openVersion3()
    await store(old, own)
    old.close()

    const db = new TeleoDB(NAME)
    await db.open()
    expect(await db.texts.toArray()).toEqual([own.text])
    expect(await db.segments.orderBy('id').toArray()).toEqual(own.segments)
    expect(await db.textStats.toArray()).toEqual([own.textStats])
    expect(await db.sessionRuns.toArray()).toEqual([own.run])
    expect(await db.attempts.toArray()).toEqual([own.attempt])
    expect(await db.achievements.toArray()).toEqual([own.achievement])
    db.close()
  })
})

describe('schema version 6: the library prayers move to keys that name no person (DECISIONS #134)', () => {
  it('moves the rows of a prayer said under its old key, and what points to them, to the new key', async () => {
    const said = (key: string) => textRows(`builtin:${key}`, 'builtin', 'en')
    const before = said('en.lovy-peace')
    const after = said('en.life-peace')
    const own = textRows('own', 'user')
    const task = (textId: string) => ({ id: 'task1', textId, timesPerDay: 3, startDay: '2026-10-05', endDay: '2026-10-18', createdAt: 1, archived: false })

    const old = openVersion3()
    old.version(5).stores({ tasks: 'id, textId, endDay', taskLog: 'id, taskId, [taskId+dayKey], dayKey, runId' })
    await store(old, before, own)
    await old.table('tasks').add(task(before.text.id))
    old.close()

    const db = new TeleoDB(NAME)
    await db.open()
    expect(byId(await db.texts.toArray())).toEqual(byId([after.text, own.text]))
    expect(await db.segments.orderBy('id').toArray()).toEqual(byId([...after.segments, ...own.segments]))
    expect(await db.textStats.orderBy('textId').toArray()).toEqual([after.textStats, own.textStats])
    expect(byId(await db.sessionRuns.toArray())).toEqual(byId([after.run, own.run]))
    expect(byId(await db.attempts.toArray())).toEqual(byId([after.attempt, own.attempt]))
    expect(await db.achievements.orderBy('key').toArray()).toEqual([own.achievement, after.achievement].sort((a, b) => a.key.localeCompare(b.key)))
    expect((await db.xpLedger.toArray()).map((row) => row.refId).sort()).toEqual([after.attempt.id, own.attempt.id].sort())
    expect(await db.tasks.toArray()).toEqual([task(after.text.id)])
    db.close()
  })
})

describe('schema version 7: the Hail Mary and the rosary decades left the content (DECISIONS #135)', () => {
  it('deletes the prayer, its decades and tasks, takes it out of own sessions and keeps the progress earned with it', async () => {
    const hail = retiredBuiltinRows('en.hail-mary', 'en')
    const zdrowas = retiredBuiltinRows('pl.zdrowas-maryjo', 'pl')
    const lords = textRows('builtin:en.lords-prayer', 'builtin', 'en')
    const template = (id: string, items: { textId: string; repeat: number }[], builtinKey?: string) => ({
      id, name: id, pinned: false, items, createdAt: 1, updatedAt: 1, source: builtinKey ? 'builtin' : 'user', archived: false,
      ...(builtinKey ? { builtinKey } : {}),
    })
    const decade = template('builtin:en.decade-of-the-rosary', [{ textId: lords.text.id, repeat: 1 }, { textId: hail.text.id, repeat: 10 }], 'en.decade-of-the-rosary')
    const dziesiatka = template('builtin:pl.dziesiatka-rozanca', [{ textId: zdrowas.text.id, repeat: 10 }], 'pl.dziesiatka-rozanca')
    const psalm = template('builtin:en.psalm-91-session', [{ textId: 'builtin:en.psalm-91', repeat: 1 }], 'en.psalm-91-session')
    const mine = template('mine', [{ textId: lords.text.id, repeat: 1 }, { textId: hail.text.id, repeat: 3 }])
    const task = (id: string, textId: string) => ({ id, textId, timesPerDay: 1, startDay: '2026-10-05', endDay: '2026-10-18', createdAt: 1, archived: false })
    const log = (id: string, taskId: string) => ({ id, taskId, dayKey: '2026-10-05', runId: 'run', timestamp: 1 })
    // A decade said to the end stays in the history; one left halfway could not be resumed.
    const sessionRun = (id: string, status: string) => ({ ...lords.run, id, textId: undefined, templateId: decade.id, status, plan: [...lords.run.plan, ...hail.run.plan] })

    const old = openVersion3()
    old.version(5).stores({ tasks: 'id, textId, endDay', taskLog: 'id, taskId, [taskId+dayKey], dayKey, runId' })
    old.version(6).stores({})
    await store(old, hail, zdrowas, lords)
    await old.table('sessionTemplates').bulkAdd([decade, dziesiatka, psalm, mine])
    await old.table('sessionRuns').bulkAdd([sessionRun('run:done', 'completed'), sessionRun('run:half', 'partial')])
    await old.table('tasks').bulkAdd([task('t-hail', hail.text.id), task('t-lords', lords.text.id)])
    await old.table('taskLog').bulkAdd([log('l-hail', 't-hail'), log('l-lords', 't-lords')])
    const ledger = await old.table('xpLedger').toArray()
    old.close()

    const db = new TeleoDB(NAME)
    await db.open()
    expect(await db.texts.toArray()).toEqual([lords.text])
    expect(await db.segments.orderBy('id').toArray()).toEqual(lords.segments)
    expect(await db.textStats.toArray()).toEqual([lords.textStats])
    expect(await db.achievements.toArray()).toEqual([lords.achievement])
    expect(byId(await db.sessionTemplates.toArray())).toEqual(byId([psalm, { ...mine, items: [{ textId: lords.text.id, repeat: 1 }] }]))
    expect((await db.sessionRuns.toArray()).map((run) => run.id).sort()).toEqual([lords.run.id, 'run:done'].sort())
    expect(await db.tasks.toArray()).toEqual([task('t-lords', lords.text.id)])
    expect(await db.taskLog.toArray()).toEqual([log('l-lords', 't-lords')])
    expect(byId(await db.attempts.toArray())).toEqual(byId([hail.attempt, zdrowas.attempt, lords.attempt]))
    expect(await db.xpLedger.toArray()).toEqual(ledger)
    db.close()
  })
})
