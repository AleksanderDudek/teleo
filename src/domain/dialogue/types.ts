import type { CharacterId, Lang } from '@/domain/types'

/** Who says a line: the conversation partner (spoken by the app) or the user (checked by the matcher). */
export type Speaker = 'bot' | 'you'

export interface DialogueLine {
  who: Speaker
  /** The line in every language, with word links (`{word|id}`, see `gloss.ts`). */
  text: Record<Lang, string>
  /**
   * The user's lines: how to say `text[lang]`, spelt for a reader of the other language (stressed syllable in
   * capitals). Keyed by the language of the line, since each language is learnt from the other one.
   */
  say?: Partial<Record<Lang, string>>
}

export type DialogueLevel = 'A1' | 'A2'

/** A scripted conversation (DECISIONS #101): one bilingual script serves learners of either language. */
export interface Dialogue {
  /** Stable id: the hidden text is `dialogue:<key>`. */
  key: string
  level: DialogueLevel
  /** Icon name (Teleo Glyph or Phosphor, see `components/icons`). */
  icon: string
  /** The figure who speaks the bot's lines. */
  partner: CharacterId
  title: Record<Lang, string>
  /** One sentence setting the scene. */
  scene: Record<Lang, string>
  lines: DialogueLine[]
}
