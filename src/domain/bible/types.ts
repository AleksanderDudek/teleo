import type { Lang } from '@/domain/types'

/** Public-domain translations shipped with the app: KJV (Pure Cambridge Edition) and Biblia Gdańska (1881). */
export type BibleTranslation = 'kjv' | 'pbg'
export const BIBLE_TRANSLATIONS = ['kjv', 'pbg'] as const satisfies readonly BibleTranslation[]

export const TRANSLATION_LANG: Record<BibleTranslation, Lang> = { kjv: 'en', pbg: 'pl' }
export const LANG_TRANSLATION: Record<Lang, BibleTranslation> = { en: 'kjv', pl: 'pbg' }
