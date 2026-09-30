import type { Dialogue } from '@/domain/dialogue'
import { LANGS, type Lang } from '@/domain/types'
import dialoguesJson from './dialogues.json'

/*
 * Scripted bilingual conversations (DECISIONS #101). Kept out of `content/index.ts` so the scripts load only
 * with the screens that use them. JSON imports widen literal types to `string`; `dialogues.test.ts` validates
 * the data (markup, links, pronunciations, icons, figures).
 */
export const DIALOGUES = dialoguesJson as Dialogue[]

/** The hidden text of a dialogue learnt in `lang` (the same script is a different text in each direction). */
export const dialogueTextId = (key: string, lang: Lang) => `dialogue:${lang}:${key}`

/** The dialogue and the language being learnt behind a hidden text id, if any. */
export function dialogueOfText(textId: string | undefined): { dialogue: Dialogue; lang: Lang } | undefined {
  const match = textId?.match(/^dialogue:([a-z]+):(.+)$/)
  const lang = LANGS.find((l) => l === match?.[1])
  const dialogue = DIALOGUES.find((d) => d.key === match?.[2])
  return lang && dialogue ? { dialogue, lang } : undefined
}
