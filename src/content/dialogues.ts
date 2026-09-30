import type { Dialogue } from '@/domain/dialogue'
import dialoguesJson from './dialogues.json'

/*
 * Scripted bilingual conversations (DECISIONS #101). Kept out of `content/index.ts` so the scripts load only
 * with the screens that use them. JSON imports widen literal types to `string`; `dialogues.test.ts` validates
 * the data (markup, links, pronunciations, icons, figures).
 */
export const DIALOGUES = dialoguesJson as Dialogue[]

export const dialogueTextId = (key: string) => `dialogue:${key}`

/** The dialogue behind a hidden text id (`dialogue:<key>`), if any. */
export function dialogueOfText(textId: string | undefined): Dialogue | undefined {
  if (!textId?.startsWith('dialogue:')) return undefined
  const key = textId.slice('dialogue:'.length)
  return DIALOGUES.find((dialogue) => dialogue.key === key)
}
