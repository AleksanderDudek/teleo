import type { GrammaticalForm, Lang, SplitMode, TextType } from '@/domain/types'
import sessionsJson from './sessions.json'
import textsJson from './texts.json'

/** Builtin text definition. PL affirmations carry m/f/n variants (spec §7.4, DECISIONS #26). */
export interface BuiltinTextDef {
  key: string
  lang: Lang
  type: TextType
  title: string
  splitMode: SplitMode
  tags: string[]
  segments?: string[]
  variants?: Record<GrammaticalForm, string[]>
}

export interface BuiltinSessionDef {
  key: string
  lang: Lang
  name: string
  /** Which onboarding focus this session belongs to. */
  focus: 'prayers' | 'affirmations'
  items: { text: string; repeat: number }[]
}

// JSON imports widen literal types to `string`; `content.test.ts` validates the data.
export const BUILTIN_TEXTS = textsJson as BuiltinTextDef[]
export const BUILTIN_SESSIONS = sessionsJson as BuiltinSessionDef[]

export const builtinTextId = (key: string) => `builtin:${key}`
export const builtinSessionId = (key: string) => `builtin:${key}`

/** Segments of a builtin text for the chosen grammatical form (non-variant texts ignore it). */
export function builtinSegments(def: BuiltinTextDef, form: GrammaticalForm): string[] {
  if (def.variants) return def.variants[form]
  return def.segments ?? []
}

/** Body text reconstructed from segments: sentences flow as prose, line-mode texts keep lines. */
export function joinSegments(segments: readonly string[], mode: SplitMode): string {
  return segments.join(mode === 'line' ? '\n' : ' ')
}
