import { builtinTextId } from '@/content'
import { db } from '@/db/schema'
import { matchesNeed, needRank, type NeedId } from '@/domain/text/needs'
import { isListedText } from '@/domain/text/visibility'
import type { Lang } from '@/domain/types'

/** A gentle prayer the tour prefers to open for its need (DECISIONS #127), when it is there and visible. */
const STORY_TEXT_KEY = (lang: Lang) => `${lang}.lovy-peace`

/**
 * The text the guided tour opens: the story's own prayer if this person can see it, else the first text the library
 * lists for the need (those mainly for it first). Undefined when the language has none visible.
 */
export async function tourTextFor(need: NeedId, lang: Lang): Promise<string | undefined> {
  const listed = (await db.texts.toArray())
    .filter((text) => !text.archived && isListedText(text, lang) && matchesNeed(text, { need }))
    .sort((a, b) => needRank(a, { need }) - needRank(b, { need }) || a.title.localeCompare(b.title))
  const story = builtinTextId(STORY_TEXT_KEY(lang))
  return listed.find((text) => text.id === story)?.id ?? listed[0]?.id
}
