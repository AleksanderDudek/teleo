/** Literal types shared by every layer. Pure module: no DOM, no Dexie. */

export type Lang = 'pl' | 'en'
export const LANGS = ['pl', 'en'] as const satisfies readonly Lang[]

export type SpeechLang = 'pl-PL' | 'en-US'
export const SPEECH_LANG: Record<Lang, SpeechLang> = { pl: 'pl-PL', en: 'en-US' }

export type TextType = 'affirmation' | 'prayer' | 'text'
export const TEXT_TYPES = ['affirmation', 'prayer', 'text'] as const satisfies readonly TextType[]

export type SplitMode = 'sentence' | 'line'
export type Strictness = 'strict' | 'lenient'
export type EngineId = 'webspeech' | 'whisper'
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
export type GrammaticalForm = 'm' | 'f' | 'n'
export type ContentFocus = 'prayers' | 'affirmations' | 'both' | 'own'
/** The figure that stands for the user (four women, four men), shown as their avatar. */
export type CharacterId = 'anna' | 'maria' | 'grace' | 'ewa' | 'jan' | 'michal' | 'david' | 'piotr'
export const CHARACTER_IDS = ['anna', 'maria', 'grace', 'ewa', 'jan', 'michal', 'david', 'piotr'] as const satisfies readonly CharacterId[]

/** Local calendar day `YYYY-MM-DD`, shifted by the configurable day-start hour. */
export type DayKey = string
