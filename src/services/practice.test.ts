import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId } from '@/content'
import { db } from '@/db/schema'
import type { SessionRun } from '@/db/types'
import { resetDb } from '@/test/db'
import { finishRun, reconcileStreakFreezes, recordAttempt, skipEntry, type Evaluation } from './practice'
import { seedBuiltins } from './seed'
import { startRun } from './sessions'
import { readSettings, updateAppSettings, updateGameState } from './settings'
import { createText } from './texts'

const at = (day: number, hour = 12, minute = 0) => new Date(2026, 8, day, hour, minute).getTime()
const ok: Evaluation = { accepted: true, coverage: 1, extra: 0, wrong: 0, transcript: 'ok' }
const bad: Evaluation = { accepted: false, coverage: 0.5, extra: 1, wrong: 0, transcript: 'nope' }

async function speakAll(run: SessionRun, start: number, failFirstOf: ReadonlySet<number> = new Set()) {
  let now = start
  for (let i = 0; i < run.plan.length; i++) {
    if (failFirstOf.has(i)) await recordAttempt({ runId: run.id, entryIndex: i, evaluation: bad, engine: 'webspeech', durationMs: 900, now: (now += 1000) })
    await recordAttempt({ runId: run.id, entryIndex: i, evaluation: ok, engine: 'webspeech', durationMs: 900, now: (now += 1000) })
  }
  return now
}

const ledgerTotal = async () => (await db.xpLedger.toArray()).reduce((sum, row) => sum + row.amount, 0)
const unlockedKeys = async () => new Set((await db.achievements.toCollection().primaryKeys()) as string[])

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', dailyGoal: 10, dayStartHour: 3 })
  await seedBuiltins()
})

describe('a full PL rosary decade', () => {
  it('counts repetitions, completion, goal, XP and achievements consistently', async () => {
    const run = await startRun({ kind: 'template', templateId: builtinSessionId('pl.dziesiatka-rozanca') }, at(25))
    const end = await speakAll(run, at(25), new Set([0]))
    const finished = await finishRun(run.id, end + 1000)

    expect(finished.clean).toBe(true)
    const reps = async (key: string) => (await db.textStats.get(builtinTextId(key)))?.repetitions
    expect(await reps('pl.ojcze-nasz')).toBe(1)
    expect(await reps('pl.zdrowas-maryjo')).toBe(10)
    expect(await reps('pl.chwala-ojcu')).toBe(1)

    const day = await db.dailyStats.get('2026-09-25')
    expect(day).toMatchObject({ segmentsAccepted: 26, attempts: 27, textsCompleted: 12, sessionsCompleted: 1, goalReached: true, langs: ['pl'], morning: false, evening: false, firstTryAccepted: 25 })

    const keys = await unlockedKeys()
    const expected = [
      `text.reps.1:${builtinTextId('pl.ojcze-nasz')}`,
      `text.reps.1:${builtinTextId('pl.zdrowas-maryjo')}`,
      `text.reps.7:${builtinTextId('pl.zdrowas-maryjo')}`,
      `text.reps.1:${builtinTextId('pl.chwala-ojcu')}`,
      'daily.10',
      'daily.25',
      'session.first',
    ]
    expect(expected.filter((key) => !keys.has(key))).toEqual([])
    expect(keys.has('session.perfect')).toBe(false) // first segment needed a second try

    const { game } = await readSettings()
    expect(game.totalXp).toBe(await ledgerTotal())
    expect(day?.xp).toBe(await ledgerTotal())
    const runRow = await db.sessionRuns.get(run.id)
    expect(runRow).toMatchObject({ status: 'completed', cursor: 26 })
    expect(runRow?.xpEarned).toBe(await ledgerTotal())
    expect((await db.xpLedger.where('reason').equals('dailyGoal').toArray())).toHaveLength(1)
    expect((await db.xpLedger.where('reason').equals('sessionComplete').toArray())).toHaveLength(1)
    expect((await db.xpLedger.where('reason').equals('textComplete').toArray())).toHaveLength(12)
  })

  it('records the first try only when the first attempt is accepted', async () => {
    const run = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(25))
    const first = await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: bad, engine: 'webspeech', durationMs: 1, now: at(25, 12, 1) })
    expect(first).toMatchObject({ accepted: false, failedAttempts: 1, xpGained: 0 })
    const second = await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(25, 12, 2) })
    expect(second).toMatchObject({ accepted: true, firstTry: false, failedAttempts: 1 })
    expect(second.segmentXp).toBe(5 + 7) // "Chwała Ojcu i Synowi, i Duchowi Świętemu." has 7 words
    await expect(recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1 })).rejects.toMatchObject({ code: 'outOfOrder' })
  })
})

describe('skips and completion', () => {
  it('a skipped segment breaks that repetition and the session bonus', async () => {
    const run = await startRun({ kind: 'text', textId: builtinTextId('pl.aniele-bozy') }, at(25))
    await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(25, 12, 1) })
    for (let i = 0; i < 3; i++) await recordAttempt({ runId: run.id, entryIndex: 1, evaluation: bad, engine: 'webspeech', durationMs: 1, now: at(25, 12, 2) })
    await skipEntry(run.id, 1, at(25, 12, 3))
    await recordAttempt({ runId: run.id, entryIndex: 2, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(25, 12, 4) })
    const finished = await finishRun(run.id, at(25, 12, 5))
    expect(finished.clean).toBe(false)
    expect((await db.textStats.get(builtinTextId('pl.aniele-bozy')))?.repetitions ?? 0).toBe(0)
    expect((await db.dailyStats.get('2026-09-25'))?.sessionsCompleted).toBe(0)
    expect(await db.xpLedger.where('reason').equals('sessionComplete').count()).toBe(0)
  })
})

describe('days, streaks and freezes', () => {
  it('attributes activity after midnight to the previous day and flags evening/morning', async () => {
    const run = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(25, 23, 50))
    await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(26, 0, 30) })
    await recordAttempt({ runId: run.id, entryIndex: 1, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(26, 6, 30) })
    expect(await db.dailyStats.get('2026-09-25')).toMatchObject({ segmentsAccepted: 1, evening: true, morning: false })
    expect(await db.dailyStats.get('2026-09-26')).toMatchObject({ segmentsAccepted: 1, morning: true })
  })

  it('earns a freeze at a 7-day streak and uses it to bridge a missed day', async () => {
    for (let day = 10; day <= 16; day++) {
      const run = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(day))
      await speakAll(run, at(day))
    }
    let { game } = await readSettings()
    expect(game.freezesAvailable).toBe(1)
    expect((await unlockedKeys()).has('streak.7')).toBe(true)

    // 17th missed; app opened on the 18th → the gap is bridged.
    expect(await reconcileStreakFreezes(at(18, 9))).toEqual(['2026-09-17'])
    ;({ game } = await readSettings())
    expect(game).toMatchObject({ freezesAvailable: 0, pendingFreezeNotice: ['2026-09-17'] })
    expect(await db.dailyStats.get('2026-09-17')).toMatchObject({ frozen: true, segmentsAccepted: 0 })
    expect(await reconcileStreakFreezes(at(18, 10))).toEqual([])
  })

  it('bridges a missed day inside the attempt when startup reconciliation did not run (app resumed from memory)', async () => {
    await updateGameState({ freezesAvailable: 1 })
    for (let day = 10; day <= 15; day++) {
      const run = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(day))
      await speakAll(run, at(day))
    }
    // The 16th is missed; on the 17th the first sentence arrives before any reconcile.
    const run = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(17))
    const outcome = await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(17, 12, 1) })
    expect(outcome.streak).toBe(7)
    expect(outcome.segmentXp).toBe(Math.round((5 + 7 + 2) * 1.25))
    expect(outcome.freezeEarned).toBe(true)
    expect(await db.dailyStats.get('2026-09-16')).toMatchObject({ frozen: true })
    expect((await readSettings()).game).toMatchObject({ freezesAvailable: 1, pendingFreezeNotice: ['2026-09-16'] })
  })

  it('does not waste freezes on a gap they cannot cover, and counts a comeback', async () => {
    await updateGameState({ freezesAvailable: 2 })
    const first = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(10))
    await speakAll(first, at(10))
    expect(await reconcileStreakFreezes(at(14))).toEqual([])
    expect((await readSettings()).game.freezesAvailable).toBe(2)
    const back = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, at(14))
    await speakAll(back, at(14))
    expect((await readSettings()).game.comebacks).toBe(1)
    expect((await unlockedKeys()).has('comeback')).toBe(true)
  })
})

describe('per-text rules on user texts', () => {
  it('a brand-new one-sentence text earns its achievements, incl. flawless after 10 first tries', async () => {
    const text = await createText({ title: 'Spokój', type: 'affirmation', lang: 'pl', splitMode: 'line', segments: ['Wybieram spokój zamiast pośpiechu.'] })
    expect((await unlockedKeys()).has('create.1')).toBe(true)
    for (let i = 0; i < 10; i++) {
      const run = await startRun({ kind: 'text', textId: text.id }, at(25, 12, i))
      await speakAll(run, at(25, 12, i))
      await finishRun(run.id, at(25, 12, i) + 5000)
    }
    const keys = await unlockedKeys()
    expect(keys.has(`text.reps.1:${text.id}`)).toBe(true)
    expect(keys.has(`text.reps.7:${text.id}`)).toBe(true)
    expect(keys.has(`text.perfect:${text.id}`)).toBe(true)
    expect(keys.has('session.10')).toBe(true)
  })
})
