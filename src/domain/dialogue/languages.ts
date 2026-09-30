import { LANGS, type Lang } from '@/domain/types'

/**
 * The language a user learns in dialogues: the other one (DECISIONS #101). The interface language is the
 * user's own language (#92); Polish speakers learn English, English speakers learn Polish.
 */
export function learningLang(native: Lang): Lang {
  return LANGS.find((lang) => lang !== native) ?? native
}

/**
 * The language translations and pronunciations are shown in for a dialogue in `target`: the interface
 * language — or, should the interface have been switched to `target` since, the other language.
 */
export function nativeLang(target: Lang, uiLang: Lang): Lang {
  return uiLang !== target ? uiLang : learningLang(target)
}
