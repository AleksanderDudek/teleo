import type { Lang } from '@/domain/types'

/*
 * One language at a time (owner decision 2026-09-27, DECISIONS #92): the interface language is also the
 * language of the texts, sessions, Bible and speech. Texts of the other language stay stored and come
 * back when the language is switched in Settings.
 */

/**
 * Texts a feature creates for itself — Bible readings (DECISIONS #85) and language dialogues (#103): never
 * listed, and no per-text achievements (thousands of readings would flood the gallery; a dialogue is a lesson).
 */
export function isHiddenText(text: { source: string }): boolean {
  return text.source === 'bible' || text.source === 'dialogue'
}

/** Texts the library, pickers and the session of the day offer: this language, never hidden feature texts. */
export function isListedText(text: { source: string; lang: Lang }, lang: Lang): boolean {
  return !isHiddenText(text) && text.lang === lang
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
