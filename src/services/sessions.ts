import { db } from '@/db/schema'
import type { Segment, SessionRun, SessionTemplate } from '@/db/types'
import {
  countTemplateSegments,
  expandTemplate,
  MAX_SESSION_SEGMENTS,
  pickDailyTexts,
  type EntryState,
  type TemplateItem,
} from '@/domain/session'
import type { MemoryLevel } from '@/domain/memory/mask'
import { dayKeyFor } from '@/domain/time/dayKey'
import { newId } from '@/lib/id'
import { readSettings } from './settings'
import { getActiveSegments } from './texts'

export type SessionErrorCode = 'nameEmpty' | 'noItems' | 'overLimit' | 'empty' | 'notFound' | 'notEditable'

export class SessionError extends Error {
  readonly code: SessionErrorCode
  constructor(code: SessionErrorCode) {
    super(`Session error: ${code}`)
    this.name = 'SessionError'
    this.code = code
  }
}

export type StartRunInput =
  | { kind: 'template'; templateId: string; memoryLevel?: MemoryLevel }
  | { kind: 'text'; textId: string; memoryLevel?: MemoryLevel }
  | { kind: 'daily'; title: string }

/** Active segments for every text referenced by `items` (texts that no longer exist are absent). */
export async function segmentsByText(items: readonly TemplateItem[]): Promise<Map<string, Segment[]>> {
  const map = new Map<string, Segment[]>()
  for (const textId of new Set(items.map((i) => i.textId))) {
    if (await db.texts.get(textId)) map.set(textId, await getActiveSegments(textId))
  }
  return map
}

export async function countSegments(items: readonly TemplateItem[]): Promise<number> {
  return countTemplateSegments(items, await segmentsByText(items))
}

async function validateTemplate(name: string, items: readonly TemplateItem[]) {
  if (!name.trim()) throw new SessionError('nameEmpty')
  if (items.length === 0) throw new SessionError('noItems')
  const count = await countSegments(items)
  if (count === 0) throw new SessionError('empty')
  if (count > MAX_SESSION_SEGMENTS) throw new SessionError('overLimit')
}

export async function createTemplate(name: string, items: TemplateItem[], now = Date.now()): Promise<SessionTemplate> {
  await validateTemplate(name, items)
  const template: SessionTemplate = {
    id: newId(),
    name: name.trim(),
    pinned: false,
    items,
    createdAt: now,
    updatedAt: now,
    source: 'user',
    archived: false,
  }
  await db.sessionTemplates.add(template)
  return template
}

export async function updateTemplate(id: string, name: string, items: TemplateItem[], now = Date.now()): Promise<SessionTemplate> {
  const existing = await db.sessionTemplates.get(id)
  if (!existing) throw new SessionError('notFound')
  if (existing.source !== 'user') throw new SessionError('notEditable')
  await validateTemplate(name, items)
  const next = { ...existing, name: name.trim(), items, updatedAt: now }
  await db.sessionTemplates.put(next)
  return next
}

/** Builtin sessions can only be hidden; user sessions are deleted (their past runs stay). */
export async function deleteTemplate(id: string): Promise<void> {
  const existing = await db.sessionTemplates.get(id)
  if (!existing) return
  if (existing.source === 'builtin') await db.sessionTemplates.update(id, { archived: true, pinned: false })
  else await db.sessionTemplates.delete(id)
}

export async function duplicateTemplate(id: string, name: string, now = Date.now()): Promise<SessionTemplate> {
  const existing = await db.sessionTemplates.get(id)
  if (!existing) throw new SessionError('notFound')
  return createTemplate(name, existing.items.map((item) => ({ ...item })), now)
}

export async function setTemplatePinned(id: string, pinned: boolean): Promise<void> {
  await db.sessionTemplates.update(id, { pinned })
}

export async function setTemplateArchived(id: string, archived: boolean): Promise<void> {
  await db.sessionTemplates.update(id, archived ? { archived, pinned: false } : { archived })
}

/** Items of the "session of the day": visible texts not spoken today, least recently practised first. */
async function dailyItems(now: number): Promise<TemplateItem[]> {
  const { app } = await readSettings()
  const today = dayKeyFor(now, app.dayStartHour)
  const [texts, stats, todayAttempts] = await Promise.all([
    db.texts.toArray(),
    db.textStats.toArray(),
    db.attempts.where('dayKey').equals(today).toArray(),
  ])
  const statsById = new Map(stats.map((s) => [s.textId, s]))
  const practicedToday = new Set(todayAttempts.filter((a) => a.accepted).map((a) => a.textId))
  const doneToday = (await db.dailyStats.get(today))?.segmentsAccepted ?? 0
  const candidates = []
  for (const text of texts.filter((t) => !t.archived)) {
    candidates.push({
      id: text.id,
      segmentCount: (await getActiveSegments(text.id)).length,
      lastPracticedAt: statsById.get(text.id)?.lastPracticedAt,
    })
  }
  const target = Math.max(1, app.dailyGoal - doneToday)
  return pickDailyTexts({ candidates, practicedToday, targetSegments: target }).map((textId) => ({ textId, repeat: 1 }))
}

const freshEntry = (): EntryState => ({ status: 'pending', attempts: 0, firstTry: false, xp: 0 })

/** Pauses every running session (only one runs at a time; also used at app start). */
export async function markRunningRunsPartial(exceptId?: string): Promise<void> {
  await db.sessionRuns
    .where('status')
    .equals('in_progress')
    .filter((run) => run.id !== exceptId)
    .modify({ status: 'partial' })
}

export async function startRun(input: StartRunInput, now = Date.now()): Promise<SessionRun> {
  const { app } = await readSettings()
  let items: TemplateItem[]
  let title: string
  let templateId: string | undefined
  let textId: string | undefined

  if (input.kind === 'template') {
    const template = await db.sessionTemplates.get(input.templateId)
    if (!template) throw new SessionError('notFound')
    items = template.items
    title = template.name
    templateId = template.id
  } else if (input.kind === 'text') {
    const text = await db.texts.get(input.textId)
    if (!text) throw new SessionError('notFound')
    items = [{ textId: text.id, repeat: 1 }]
    title = text.title
    textId = text.id
  } else {
    items = await dailyItems(now)
    title = input.title
  }

  const { plan } = expandTemplate(items, await segmentsByText(items))
  if (plan.length === 0) throw new SessionError('empty')

  const run: SessionRun = {
    id: newId(),
    templateId,
    textId,
    title,
    dayKey: dayKeyFor(now, app.dayStartHour),
    startedAt: now,
    status: 'in_progress',
    plan,
    entries: plan.map(freshEntry),
    cursor: 0,
    xpEarned: 0,
    lastActivityAt: now,
    mode: input.kind !== 'daily' && input.memoryLevel ? 'memory' : 'read',
    ...(input.kind !== 'daily' && input.memoryLevel ? { memoryLevel: input.memoryLevel } : {}),
  }
  await db.transaction('rw', [db.sessionRuns, db.sessionTemplates], async () => {
    await markRunningRunsPartial()
    await db.sessionRuns.add(run)
    if (templateId) await db.sessionTemplates.update(templateId, { lastUsedAt: now })
  })
  return run
}

/** Most recent unfinished run of today, if any (spec §8.3/6: resume the same day). */
export async function findResumableRun(now = Date.now()): Promise<SessionRun | undefined> {
  const { app } = await readSettings()
  const today = dayKeyFor(now, app.dayStartHour)
  const runs = await db.sessionRuns.where('dayKey').equals(today).toArray()
  return runs
    .filter((run) => run.status !== 'completed' && run.cursor < run.plan.length)
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)[0]
}

export async function resumeRun(runId: string, now = Date.now()): Promise<SessionRun> {
  return db.transaction('rw', db.sessionRuns, async () => {
    const run = await db.sessionRuns.get(runId)
    if (!run) throw new SessionError('notFound')
    await markRunningRunsPartial(runId)
    const next = { ...run, status: 'in_progress' as const, lastActivityAt: now }
    await db.sessionRuns.put(next)
    return next
  })
}
