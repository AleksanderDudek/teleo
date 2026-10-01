import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId } from '@/content'
import { ALL_TABLES, db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { decryptBackup, readBackupText } from '@/domain/backup'
import { backupFileName, deviceSummary, exportBackup, importBackupJson, prepareBackup, readRestorePoint, undoImport, wipeAllData } from './backup'
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
  it('keeps the data an import replaced, and undo brings it back exactly', async () => {
    const before = await snapshot()
    const other = await exportBackup(1)
    // A different history: a backup of a fresh install.
    await wipeAllData()
    await updateAppSettings({ uiLang: 'en', onboardingCompleted: true })
    const fresh = JSON.stringify(await exportBackup(2))
    await importBackupJson(JSON.stringify(other), 10)
    expect(await snapshot()).toEqual(before)

    expect(await importBackupJson(fresh, 20)).toEqual({ ok: true })
    expect((await readSettings()).app.uiLang).toBe('en')
    const point = await readRestorePoint()
    expect(point).toMatchObject({ key: 'beforeImport', createdAt: 20 })
    expect(point?.summary.sentences).toBeGreaterThan(0)

    expect(await undoImport()).toEqual({ ok: true })
    expect(await snapshot()).toEqual(before)
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
    expect(await undoImport()).toEqual({ ok: false, code: 'noRestorePoint' })
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
