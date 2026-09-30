import { DIALOGUES, dialogueOfText, dialogueTextId } from '@/content/dialogues'
import { db } from '@/db/schema'
import type { SessionRun, TextItem } from '@/db/types'
import { dialogueSegments, learningLang, nextDialogueKey } from '@/domain/dialogue'
import type { Lang } from '@/domain/types'
import { SessionError, startRun } from './sessions'
import { readSettings } from './settings'
import { replaceSegments, SEGMENT_EDIT_TABLES } from './texts'

/**
 * Starts a language dialogue (DECISIONS #103): the user's lines, in the language being learnt, become a hidden
 * text (`source: 'dialogue'`) — created once, brought up to date with the script on later starts (lines spoken
 * before a change are archived, never lost) — and are played as an ordinary run, so the matcher, coverage
 * ladder, XP, streaks, daily goal and golden quarter-hour all apply. The bot's lines come from the script.
 */
export async function startDialogue(key: string, now = Date.now()): Promise<SessionRun> {
  const dialogue = DIALOGUES.find((d) => d.key === key)
  if (!dialogue) throw new SessionError('notFound')
  const { app } = await readSettings()
  const lang = learningLang(app.uiLang)
  const textId = dialogueTextId(key, lang)
  const segments = dialogueSegments(dialogue, lang)
  const title = dialogue.title[app.uiLang]
  await db.transaction('rw', SEGMENT_EDIT_TABLES, async () => {
    const existing = await db.texts.get(textId)
    const text: TextItem = existing
      ? { ...existing, title, body: segments.join(' ') }
      : {
          id: textId,
          title,
          type: 'text',
          lang,
          body: segments.join(' '),
          source: 'dialogue',
          tags: [],
          archived: false,
          splitMode: 'sentence',
          createdAt: now,
          updatedAt: now,
        }
    await db.texts.put(text)
    await replaceSegments(textId, segments)
  })
  return startRun({ kind: 'text', textId }, now)
}

/** Keys of the dialogues said to the end at least once in `lang`. */
export async function finishedDialogues(lang: Lang): Promise<Set<string>> {
  const ids = DIALOGUES.map((d) => dialogueTextId(d.key, lang))
  const stats = await db.textStats.bulkGet(ids)
  return new Set(DIALOGUES.filter((_, i) => (stats[i]?.repetitions ?? 0) > 0).map((d) => d.key))
}

/** After a dialogue: the next one not finished yet (wrapping round). Undefined when `textId` is no dialogue. */
export async function startNextDialogue(textId: string, now = Date.now()): Promise<SessionRun | undefined> {
  const current = dialogueOfText(textId)
  if (!current) return undefined
  const finished = await finishedDialogues(current.lang)
  const key = nextDialogueKey(
    DIALOGUES.map((d) => d.key),
    current.dialogue.key,
    finished,
  )
  return key ? startDialogue(key, now) : undefined
}
