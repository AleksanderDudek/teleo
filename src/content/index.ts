import type { GrammaticalForm, Lang, SplitMode, TextType } from '@/domain/types'
import sessionsJson from './sessions.json'
import textsJson from './texts.json'

/** Builtin text definition. PL texts may carry m/f/n variants (spec §7.4, DECISIONS #26). */
export interface BuiltinTextDef {
  key: string
  lang: Lang
  type: TextType
  title: string
  splitMode: SplitMode
  tags: string[]
  /** What it is prayed for: ids of `src/domain/text/needs.ts`, main need first (DECISIONS #125). */
  needs: string[]
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
/** The core builtin texts, bundled: the classic prayers, Scripture and affirmations the sessions use. */
export const CORE_TEXTS = textsJson as BuiltinTextDef[]
export const BUILTIN_SESSIONS = sessionsJson as BuiltinSessionDef[]

/**
 * Every builtin text: the core set plus the prayer library (`prayers/*.json`, ~0.5 MB), which is a separate chunk
 * loaded only when builtins are seeded or re-rendered — not at start-up (DECISIONS #126).
 */
export async function loadBuiltinTexts(): Promise<BuiltinTextDef[]> {
  const [en, pl] = await Promise.all([import('./prayers/en.json'), import('./prayers/pl.json')])
  return [...CORE_TEXTS, ...(en.default as BuiltinTextDef[]), ...(pl.default as BuiltinTextDef[])]
}

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
