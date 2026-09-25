import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId } from '@/content'
import { ALL_TABLES, db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { backupFileName, exportBackup, importBackupJson, wipeAllData } from './backup'
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
    expect(file).toMatchObject({ app: 'teleo', schemaVersion: 1, exportedAt: 1_700_000_000_000 })
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

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 8, 25, 10).getTime())).toBe('teleo-backup-2026-09-25.json')
  })
})
