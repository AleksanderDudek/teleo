import { beforeEach, describe, expect, it } from 'vitest'
import { DIALOGUES } from '@/content/dialogues'
import { db } from '@/db/schema'
import { dialogueSegments } from '@/domain/dialogue'
import { resetDb } from '@/test/db'
import { finishedDialogues, startDialogue, startNextDialogue } from './dialogues'
import { finishRun, recordAttempt, type Evaluation } from './practice'
import { SessionError } from './sessions'
import { updateAppSettings } from './settings'

const ok: Evaluation = { accepted: true, coverage: 1, extra: 0, wrong: 0, transcript: 'ok' }
const at = (minute: number) => new Date(2026, 8, 30, 12, minute).getTime()
const cafe = DIALOGUES.find((d) => d.key === 'cafe')!

async function sayAll(runId: string, turns: number, from = 1) {
  for (let i = 0; i < turns; i++) {
    await recordAttempt({ runId, entryIndex: i, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(from + i) })
  }
  return finishRun(runId, at(from + turns))
}

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ uiLang: 'pl', dayStartHour: 3, dailyGoal: 50 })
})

describe('startDialogue', () => {
  it('turns the user lines into a hidden text in the language being learnt and starts it', async () => {
    const run = await startDialogue('cafe', at(0))
    const text = await db.texts.get('dialogue:en:cafe')
    expect(text).toMatchObject({ source: 'dialogue', lang: 'en', type: 'text', title: 'W kawiarni', archived: false })
    const segments = await db.segments.where('textId').equals('dialogue:en:cafe').sortBy('order')
    expect(segments.map((s) => s.content)).toEqual(dialogueSegments(cafe, 'en'))
    expect(run).toMatchObject({ textId: 'dialogue:en:cafe', title: 'W kawiarni', status: 'in_progress' })
    expect(run.plan).toHaveLength(dialogueSegments(cafe, 'en').length)
    expect(run.plan.every((entry) => entry.fullText)).toBe(true)
  })

  it('learns Polish from English: an English interface gets the Polish lines', async () => {
    await updateAppSettings({ uiLang: 'en' })
    const run = await startDialogue('cafe', at(0))
    expect(await db.texts.get('dialogue:pl:cafe')).toMatchObject({ lang: 'pl', title: 'At the café' })
    expect(run.textId).toBe('dialogue:pl:cafe')
  })

  it('reuses the text when the dialogue is started again', async () => {
    await startDialogue('cafe', at(0))
    await startDialogue('cafe', at(1))
    expect(await db.texts.where('source').equals('dialogue').count()).toBe(1)
    expect(await db.segments.where('textId').equals('dialogue:en:cafe').count()).toBe(dialogueSegments(cafe, 'en').length)
  })

  it('follows script changes of a later version and keeps the old lines already spoken', async () => {
    const first = await startDialogue('cafe', at(0))
    await recordAttempt({ runId: first.id, entryIndex: 0, evaluation: ok, engine: 'webspeech', durationMs: 1, now: at(1) })
    const spoken = first.plan[0]!.segmentId
    await db.segments.update(spoken, { content: 'An older wording.' })

    await startDialogue('cafe', at(2))
    const active = (await db.segments.where('textId').equals('dialogue:en:cafe').sortBy('order')).filter((s) => !s.archived)
    expect(active.map((s) => s.content)).toEqual(dialogueSegments(cafe, 'en'))
    expect(await db.segments.get(spoken)).toMatchObject({ archived: true, content: 'An older wording.' })
  })

  it('refuses a dialogue that does not exist', async () => {
    await expect(startDialogue('nope', at(0))).rejects.toBeInstanceOf(SessionError)
  })
})

describe('practising a dialogue', () => {
  it('counts the lines like sentences, the whole dialogue as a repetition, and no per-text achievements', async () => {
    const run = await startDialogue('cafe', at(0))
    const outcome = await sayAll(run.id, run.plan.length)
    expect(outcome.clean).toBe(true)
    expect(await db.textStats.get('dialogue:en:cafe')).toMatchObject({ repetitions: 1, segmentsAccepted: run.plan.length })
    expect((await db.dailyStats.get('2026-09-30'))?.langs).toEqual(['en'])
    const keys = (await db.achievements.toCollection().primaryKeys()) as string[]
    expect(keys.filter((key) => key.includes('dialogue:'))).toEqual([])
    expect(await finishedDialogues('en')).toEqual(new Set(['cafe']))
    expect(await finishedDialogues('pl')).toEqual(new Set())
  })
})

describe('startNextDialogue', () => {
  it('starts the next dialogue not finished yet', async () => {
    const run = await startDialogue(DIALOGUES[0]!.key, at(0))
    await sayAll(run.id, run.plan.length)
    const next = await startNextDialogue(run.textId!, at(30))
    expect(next?.textId).toBe(`dialogue:en:${DIALOGUES[1]!.key}`)
  })

  it('has nothing to start after a text that is not a dialogue', async () => {
    expect(await startNextDialogue('builtin:en.lords-prayer', at(0))).toBeUndefined()
  })
})
