import { db } from '@/db/schema'
import { matchesNeed, type NeedId } from '@/domain/text/needs'
import { isListedText } from '@/domain/text/visibility'
import type { Lang } from '@/domain/types'

/** The text the guided tour opens: the first one the library lists for a need (visible, this language), if any. */
export async function firstTextForNeed(need: NeedId, lang: Lang): Promise<string | undefined> {
  const texts = (await db.texts.toArray())
    .filter((text) => !text.archived && isListedText(text, lang) && matchesNeed(text, { need }))
    .sort((a, b) => a.title.localeCompare(b.title))
  return texts[0]?.id
}
