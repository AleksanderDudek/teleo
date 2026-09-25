import { beforeEach, describe, expect, it } from 'vitest'
import { builtinSessionId, builtinTextId } from '@/content'
import { db } from '@/db/schema'
import { resetDb } from '@/test/db'
import { seedBuiltins } from './seed'
import {
  createTemplate,
  deleteTemplate,
  findResumableRun,
  markRunningRunsPartial,
  resumeRun,
  SessionError,
  startRun,
  updateTemplate,
} from './sessions'
import { updateAppSettings } from './settings'
import { createText } from './texts'

const NOON = new Date(2026, 8, 25, 12).getTime()
const ROSARY = builtinSessionId('pl.dziesiatka-rozanca')

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', contentFocus: 'both', dailyGoal: 10 })
  await seedBuiltins()
})

describe('templates', () => {
  it('creates and validates user templates', async () => {
    const text = await createText({ title: 'A', type: 'affirmation', lang: 'pl', splitMode: 'line', segments: ['Jestem spokojny i silny.'] })
    const template = await createTemplate('  Moja sesja ', [{ textId: text.id, repeat: 3 }], 5)
    expect(template).toMatchObject({ name: 'Moja sesja', source: 'user', pinned: false, archived: false, createdAt: 5 })
    await expect(createTemplate(' ', [{ textId: text.id, repeat: 1 }])).rejects.toMatchObject({ code: 'nameEmpty' })
    await expect(createTemplate('X', [])).rejects.toMatchObject({ code: 'noItems' })
    await expect(createTemplate('X', [{ textId: text.id, repeat: 100 }, { textId: text.id, repeat: 51 }])).rejects.toMatchObject({ code: 'overLimit' })
    await expect(createTemplate('X', [{ textId: 'missing', repeat: 1 }])).rejects.toBeInstanceOf(SessionError)
  })

  it('protects builtin templates: no edits, delete only hides', async () => {
    await expect(updateTemplate(ROSARY, 'X', [{ textId: builtinTextId('pl.ojcze-nasz'), repeat: 1 }])).rejects.toMatchObject({ code: 'notEditable' })
    await deleteTemplate(ROSARY)
    expect(await db.sessionTemplates.get(ROSARY)).toMatchObject({ archived: true, pinned: false })
  })
})

describe('runs', () => {
  it('expands the PL rosary decade into 26 entries and records last use', async () => {
    const run = await startRun({ kind: 'template', templateId: ROSARY }, NOON)
    expect(run).toMatchObject({ status: 'in_progress', dayKey: '2026-09-25', cursor: 0, title: 'Dziesiątka różańca', templateId: ROSARY })
    expect(run.plan).toHaveLength(26)
    expect(run.entries.every((e) => e.status === 'pending' && e.attempts === 0)).toBe(true)
    expect((await db.sessionTemplates.get(ROSARY))?.lastUsedAt).toBe(NOON)
  })

  it('starts an ad-hoc run from one text', async () => {
    const run = await startRun({ kind: 'text', textId: builtinTextId('pl.aniele-bozy') }, NOON)
    expect(run.plan).toHaveLength(3)
    expect(run.textId).toBe(builtinTextId('pl.aniele-bozy'))
  })

  it('builds the session of the day from visible texts not spoken today', async () => {
    const run = await startRun({ kind: 'daily', title: 'Sesja dnia' }, NOON)
    const texts = new Set(run.plan.map((e) => e.textId))
    expect(run.title).toBe('Sesja dnia')
    expect(run.plan.length).toBeGreaterThanOrEqual(10)
    for (const id of texts) expect(id.startsWith('builtin:pl.')).toBe(true)
  })

  it('keeps only one running session and resumes today’s partial run', async () => {
    const first = await startRun({ kind: 'template', templateId: ROSARY }, NOON)
    await db.sessionRuns.update(first.id, { cursor: 3, lastActivityAt: NOON + 10 })
    const second = await startRun({ kind: 'text', textId: builtinTextId('pl.chwala-ojcu') }, NOON + 20)
    expect((await db.sessionRuns.get(first.id))?.status).toBe('partial')

    await markRunningRunsPartial()
    expect((await db.sessionRuns.get(second.id))?.status).toBe('partial')
    const resumable = await findResumableRun(NOON + 30)
    expect(resumable?.id).toBe(second.id)

    const resumed = await resumeRun(first.id, NOON + 40)
    expect(resumed.status).toBe('in_progress')
    expect(await findResumableRun(NOON + 40)).toMatchObject({ id: first.id })
    expect(await findResumableRun(new Date(2026, 8, 26, 12).getTime())).toBeUndefined()
  })

  it('refuses to start an empty session', async () => {
    await expect(startRun({ kind: 'text', textId: 'nope' }, NOON)).rejects.toMatchObject({ code: 'notFound' })
  })
})
