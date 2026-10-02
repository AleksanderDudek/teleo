import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId } from '@/content'
import { ALL_TABLES, db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { decryptBackup, readBackupText, summarizeBackup } from '@/domain/backup'
import { dialogueRows, withTextRows } from '@/test/textRows'
import { backupFileName, deviceSummary, exportBackup, importBackupJson, prepareBackup, readRestorePoint, switchToRestorePoint, wipeAllData } from './backup'
import { finishRun, markHinted, recordAttempt } from './practice'
import { seedBuiltins } from './seed'
import { startRun } from './sessions'
import { readSettings, updateAppSettings } from './settings'
import { createText } from './texts'

async function snapshot() {
  const entries = await Promise.all(ALL_TABLES.map(async (name) => [name, await db.table(name).toArray()] as const))
  return Object.fromEntries(entries)
}

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', onboardingCompleted: true })
  await seedBuiltins()
  await createText({ title: 'Moje', type: 'affirmation', lang: 'pl', splitMode: 'line', segments: ['Jestem spokojny i silny.'] })
  const run = await startRun({ kind: 'template', templateId: builtinSessionId('pl.dziesiatka-rozanca') })
  for (let i = 0; i < run.plan.length; i++) {
    await recordAttempt({ runId: run.id, entryIndex: i, evaluation: { accepted: true, coverage: 1, extra: 0, wrong: 0, transcript: 'ok' }, engine: 'webspeech', durationMs: 900 })
  }
  await finishRun(run.id)
  // A paused memory-mode run with a hinted sentence (optional fields must survive the round trip).
  const memory = await startRun({ kind: 'text', textId: builtinTextId('pl.aniele-bozy'), memoryLevel: 'hidden' })
  await markHinted(memory.id, 0)
})

describe('backup', () => {
  it('export → wipe → import restores every table exactly (spec §17)', async () => {
    const before = await snapshot()
    const file = await exportBackup(1_700_000_000_000)
    expect(file).toMatchObject({ app: 'teleo', schemaVersion: 1, exportedAt: 1_700_000_000_000, appVersion: 'test' })
    const json = JSON.stringify(file)

    await wipeAllData()
    expect(await db.texts.count()).toBe(0)

    const result = await importBackupJson(json)
    expect(result).toEqual({ ok: true })
    expect(await snapshot()).toEqual(before)
    expect((await readSettings()).app.onboardingCompleted).toBe(true)
  })

  it('rejects files that are not Teleo backups and leaves data untouched', async () => {
    const before = await snapshot()
    expect(await importBackupJson('{"hello": 1}')).toMatchObject({ ok: false, code: 'wrongApp' })
    expect(await importBackupJson('not json')).toMatchObject({ ok: false, code: 'notJson' })
    expect(await snapshot()).toEqual(before)
  })

  it('reports (and rolls back) a structurally valid backup that the database rejects', async () => {
    const before = await snapshot()
    const file = await exportBackup()
    const duplicated = { ...file, data: { ...file.data, texts: [...file.data.texts, file.data.texts[0]!] } }
    expect(await importBackupJson(JSON.stringify(duplicated))).toMatchObject({ ok: false, code: 'invalidShape' })
    expect(await snapshot()).toEqual(before)
  })

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 8, 25, 10).getTime())).toBe('teleo-backup-2026-09-25.json')
  })
})

describe('restore point', () => {
  const sayOneMore = async () => {
    const run = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') })
    await recordAttempt({ runId: run.id, entryIndex: 0, evaluation: { accepted: true, coverage: 1, extra: 0, wrong: 0, transcript: 'ok' }, engine: 'webspeech', durationMs: 900 })
  }
  const sentences = async () => (await deviceSummary()).sentences

  it('keeps the data a restore replaced; switching back loses nothing done since', async () => {
    const older = JSON.stringify(await exportBackup(1))
    await sayOneMore()
    const atRestore = await sentences()

    expect(await importBackupJson(older, 20)).toEqual({ ok: true })
    const point = await readRestorePoint()
    expect(point).toMatchObject({ key: 'previous', kind: 'beforeRestore', createdAt: 20, summary: { sentences: atRestore } })

    // Practice after the restore, then undo it: the later practice is kept, not lost.
    await sayOneMore()
    const afterPractice = await sentences()
    expect(await switchToRestorePoint(30)).toEqual({ ok: true })
    expect(await sentences()).toBe(atRestore)
    expect(await readRestorePoint()).toMatchObject({ kind: 'beforeUndo', createdAt: 30, summary: { sentences: afterPractice } })

    // And back again.
    expect(await switchToRestorePoint(40)).toEqual({ ok: true })
    expect(await sentences()).toBe(afterPractice)
    expect(await readRestorePoint()).toMatchObject({ kind: 'beforeRestore', summary: { sentences: atRestore } })
  })

  it('restores the replaced data exactly', async () => {
    const before = await snapshot()
    const file = JSON.stringify(await exportBackup(1))
    await wipeAllData()
    await updateAppSettings({ uiLang: 'en', onboardingCompleted: true })
    const fresh = JSON.stringify(await exportBackup(2))
    await importBackupJson(file, 10)
    expect(await snapshot()).toEqual(before)
    await importBackupJson(fresh, 20)
    expect((await readSettings()).app.uiLang).toBe('en')
    expect(await switchToRestorePoint(30)).toEqual({ ok: true })
    expect(await snapshot()).toEqual(before)
    // The fresh install held no progress: nothing to switch back to.
    expect(await readRestorePoint()).toBeUndefined()
  })

  it('is not kept for a device without progress, nor after a failed import', async () => {
    const file = await exportBackup()
    const duplicated = { ...file, data: { ...file.data, texts: [...file.data.texts, file.data.texts[0]!] } }
    expect(await importBackupJson(JSON.stringify(duplicated))).toMatchObject({ ok: false })
    expect(await readRestorePoint()).toBeUndefined()

    await wipeAllData()
    expect(await importBackupJson(JSON.stringify(file))).toEqual({ ok: true })
    expect(await readRestorePoint()).toBeUndefined()
  })

  it('goes with everything else when all data is deleted', async () => {
    await importBackupJson(JSON.stringify(await exportBackup()))
    expect(await readRestorePoint()).toBeDefined()
    await wipeAllData()
    expect(await readRestorePoint()).toBeUndefined()
    expect(await switchToRestorePoint()).toEqual({ ok: false, code: 'noRestorePoint' })
  })
})

describe('backups made while language dialogues existed (DECISIONS #118)', () => {
  const cafe = dialogueRows('cafe', 'en')
  const dialogueRowsGone = async () => {
    expect(await db.texts.get(cafe.text.id)).toBeUndefined()
    expect(await db.segments.where('textId').equals(cafe.text.id).count()).toBe(0)
    expect(await db.textStats.get(cafe.text.id)).toBeUndefined()
    expect(await db.sessionRuns.get(cafe.run.id)).toBeUndefined()
    expect(await db.achievements.get(cafe.achievement.key)).toBeUndefined()
  }

  it('import without the dialogue rows; the progress earned with them stays', async () => {
    const before = await snapshot()
    const file = await exportBackup(1)
    const old = { ...file, data: withTextRows(file.data, cafe) }
    await wipeAllData()

    expect(await importBackupJson(JSON.stringify(old), 10)).toEqual({ ok: true })
    await dialogueRowsGone()
    expect(await db.attempts.get(cafe.attempt.id)).toEqual(cafe.attempt)
    expect(await db.xpLedger.where('timestamp').equals(cafe.xp.timestamp).filter((row) => row.refId === cafe.attempt.id).count()).toBe(1)
    const after = await snapshot()
    expect({ ...after, attempts: [], xpLedger: [] }).toEqual({ ...before, attempts: [], xpLedger: [] })
    expect(after.attempts).toHaveLength(before.attempts!.length + 1)
    expect(after.xpLedger).toHaveLength(before.xpLedger!.length + 1)
  })

  it('switching to a restore point kept before they left brings no dialogue rows back', async () => {
    const before = await snapshot()
    const file = await exportBackup(1)
    const data = withTextRows(file.data, cafe)
    await db.restorePoints.put({ key: 'previous', kind: 'beforeRestore', createdAt: 1, summary: summarizeBackup(data), file: { ...file, data } })

    expect(await switchToRestorePoint(10)).toEqual({ ok: true })
    await dialogueRowsGone()
    expect(await db.attempts.get(cafe.attempt.id)).toEqual(cafe.attempt)
    expect({ ...(await snapshot()), attempts: [], xpLedger: [] }).toEqual({ ...before, attempts: [], xpLedger: [] })
  })
})

describe('prepareBackup', () => {
  it('builds a plain backup file ready to save or share', async () => {
    const prepared = await prepareBackup({ now: new Date(2026, 9, 1, 9).getTime() })
    expect(prepared).toMatchObject({ fileName: 'teleo-backup-2026-10-01.json', encrypted: false })
    expect(prepared.blob.type).toBe('application/json')
    expect(prepared.size).toBe(prepared.blob.size)
    const text = await prepared.blob.text()
    expect(readBackupText(text).kind).toBe('plain')
    expect(JSON.parse(text).data.texts.length).toBe((await db.texts.count()))
  })

  it('seals the backup with a password when asked', async () => {
    const prepared = await prepareBackup({ password: 'różaniec', iterations: 1_000, now: new Date(2026, 9, 1, 9).getTime() })
    expect(prepared).toMatchObject({ fileName: 'teleo-backup-2026-10-01-protected.json', encrypted: true })
    const read = readBackupText(await prepared.blob.text())
    if (read.kind !== 'encrypted') throw new Error(`expected an encrypted file, got ${read.kind}`)
    const json = await decryptBackup(read.envelope, 'różaniec')
    await wipeAllData()
    expect(await importBackupJson(json)).toEqual({ ok: true })
    expect(await db.texts.count()).toBeGreaterThan(0)
  })
})

describe('deviceSummary', () => {
  it('describes what is on this device', async () => {
    const summary = await deviceSummary()
    expect(summary.sentences).toBeGreaterThan(0)
    expect(summary.activeDays).toBe(1)
    expect(summary.ownTexts).toBe(1)
    expect(summary.xp).toBe((await readSettings()).game.totalXp)
  })
})
