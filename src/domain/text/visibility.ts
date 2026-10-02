import { isRetiredText } from '@/domain/backup/retired'
import type { Lang } from '@/domain/types'

/*
 * One language at a time (owner decision 2026-09-27, DECISIONS #92): the interface language is also the
 * language of the texts, sessions, Bible and speech. Texts of the other language stay stored and come
 * back when the language is switched in Settings.
 */

/**
 * Texts the library, pickers and the session of the day offer: this language, never Bible readings — nor texts of a
 * retired feature (DECISIONS #118), which a tab still running an older version could write after the upgrade.
 */
export function isListedText(text: { source: string; lang: Lang }, lang: Lang): boolean {
  return text.source !== 'bible' && !isRetiredText(text) && text.lang === lang
}

/**
 * Sessions of this language: a builtin session carries its language; a user session speaks the language
 * of its (first remaining) text. One whose texts are all gone stays visible, so it can be fixed or deleted.
 */
export function isListedTemplate(
  template: { lang?: Lang; items: ReadonlyArray<{ textId: string }> },
  texts: ReadonlyMap<string, { lang: Lang }>,
  lang: Lang,
): boolean {
  const own = template.lang ?? template.items.map((item) => texts.get(item.textId)?.lang).find((l) => l !== undefined)
  return own === undefined || own === lang
}
