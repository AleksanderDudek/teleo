import Dexie from 'dexie'
import { db } from '@/db/schema'
import type { Segment, TextItem } from '@/db/types'
import { countWords } from '@/domain/text/countWords'
import type { Lang, SplitMode, TextType } from '@/domain/types'
import { newId } from '@/lib/id'

export const MAX_TITLE_LENGTH = 120
export const MAX_SEGMENTS = 150
export const MAX_SEGMENT_WORDS = 80

export type TextValidationCode = 'titleEmpty' | 'titleTooLong' | 'noSegments' | 'tooManySegments' | 'segmentTooLong' | 'segmentEmpty' | 'notEditable'

export class TextValidationError extends Error {
  readonly code: TextValidationCode
  constructor(code: TextValidationCode) {
    super(`Invalid text: ${code}`)
    this.name = 'TextValidationError'
    this.code = code
  }
}

export interface TextInput {
  title: string
  type: TextType
  lang: Lang
  splitMode: SplitMode
  /** Final segment list confirmed in the editor. */
  segments: string[]
  tags?: string[]
}

function validate(input: TextInput): string[] {
  const title = input.title.trim()
  if (!title) throw new TextValidationError('titleEmpty')
  if (title.length > MAX_TITLE_LENGTH) throw new TextValidationError('titleTooLong')
  const segments = input.segments.map((s) => s.trim())
  if (segments.length === 0) throw new TextValidationError('noSegments')
  if (segments.length > MAX_SEGMENTS) throw new TextValidationError('tooManySegments')
  for (const segment of segments) {
    if (countWords(segment) === 0) throw new TextValidationError('segmentEmpty')
    if (countWords(segment) > MAX_SEGMENT_WORDS) throw new TextValidationError('segmentTooLong')
  }
  return segments
}

const joinBody = (segments: readonly string[], mode: SplitMode) => segments.join(mode === 'line' ? '\n' : ' ')

/** Active (non-archived) segments of a text in reading order. */
export async function getActiveSegments(textId: string): Promise<Segment[]> {
  return db.segments
    .where('[textId+order]')
    .between([textId, Dexie.minKey], [textId, Dexie.maxKey])
    .filter((segment) => !segment.archived)
    .toArray()
}

async function hasAttempts(segmentId: string): Promise<boolean> {
  return (await db.attempts.where('segmentId').equals(segmentId).limit(1).count()) > 0
}

/**
 * Replaces the active segments of a text while preserving history (spec §10):
 * unchanged sentences keep their ids (and attempt history); segments that were
 * removed or edited are archived when they were ever spoken, deleted otherwise.
 * Must run inside a transaction covering `segments` and `attempts`.
 */
export async function replaceSegments(textId: string, contents: readonly string[]): Promise<Segment[]> {
  const pool = new Map<string, Segment[]>()
  for (const segment of await getActiveSegments(textId)) {
    const queue = pool.get(segment.content)
    if (queue) queue.push(segment)
    else pool.set(segment.content, [segment])
  }

  const next: Segment[] = contents.map((content, order) => {
    const reused = pool.get(content)?.shift()
    return reused
      ? { ...reused, order }
      : { id: newId(), textId, order, content, wordCount: countWords(content), archived: false }
  })

  for (const leftover of [...pool.values()].flat()) {
    if (await hasAttempts(leftover.id)) await db.segments.put({ ...leftover, archived: true })
    else await db.segments.delete(leftover.id)
  }
  await db.segments.bulkPut(next)
  return next
}

export async function createText(input: TextInput, now = Date.now()): Promise<TextItem> {
  const segments = validate(input)
  const text: TextItem = {
    id: newId(),
    title: input.title.trim(),
    type: input.type,
    lang: input.lang,
    body: joinBody(segments, input.splitMode),
    source: 'user',
    tags: input.tags ?? [],
    archived: false,
    splitMode: input.splitMode,
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', [db.texts, db.segments, db.attempts], async () => {
    await db.texts.add(text)
    await replaceSegments(text.id, segments)
  })
  return text
}

/** Edits a user text. Repetition counters and history are kept (typo fixes never cost progress). */
export async function updateText(textId: string, input: TextInput, now = Date.now()): Promise<TextItem> {
  const segments = validate(input)
  return db.transaction('rw', [db.texts, db.segments, db.attempts], async () => {
    const existing = await db.texts.get(textId)
    if (!existing || existing.source !== 'user') throw new TextValidationError('notEditable')
    const text: TextItem = {
      ...existing,
      title: input.title.trim(),
      type: input.type,
      lang: input.lang,
      splitMode: input.splitMode,
      tags: input.tags ?? existing.tags,
      body: joinBody(segments, input.splitMode),
      updatedAt: now,
    }
    await db.texts.put(text)
    await replaceSegments(textId, segments)
    return text
  })
}

export async function setTextArchived(textId: string, archived: boolean, now = Date.now()): Promise<void> {
  await db.texts.update(textId, { archived, updatedAt: now })
}

/** Builtin texts are read-only; editing starts from a personal copy. */
export async function copyTextAsOwn(textId: string, title: string, now = Date.now()): Promise<TextItem> {
  const source = await db.texts.get(textId)
  if (!source) throw new TextValidationError('notEditable')
  const segments = (await getActiveSegments(textId)).map((s) => s.content)
  return createText({ title, type: source.type, lang: source.lang, splitMode: source.splitMode, segments, tags: source.tags }, now)
}

/**
 * Deletes a user text with its segments, per-text stats and per-text achievements,
 * and removes it from session templates. Attempts, daily stats and XP stay: they
 * are history, not properties of the text (DECISIONS #28).
 */
export async function deleteUserText(textId: string): Promise<void> {
  await db.transaction('rw', [db.texts, db.segments, db.textStats, db.achievements, db.sessionTemplates], async () => {
    const text = await db.texts.get(textId)
    if (!text || text.source !== 'user') throw new TextValidationError('notEditable')
    await db.texts.delete(textId)
    await db.segments.where('textId').equals(textId).delete()
    await db.textStats.delete(textId)
    await db.achievements.where('textId').equals(textId).delete()
    await db.sessionTemplates.toCollection().modify((template) => {
      template.items = template.items.filter((item) => item.textId !== textId)
    })
  })
}
