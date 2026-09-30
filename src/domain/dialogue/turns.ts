import type { Lang } from '@/domain/types'
import { parseGloss } from './gloss'
import type { Dialogue } from './types'

/*
 * A dialogue is played as an ordinary run whose plan holds the user's lines only (DECISIONS #103): the run's
 * cursor counts the user's turns, and the bot's lines around them are derived from the script.
 */

/** Script indices of the lines the user says, in order (turn k ↔ plan entry k ↔ segment order k). */
export function userLines(dialogue: Dialogue): number[] {
  return dialogue.lines.flatMap((line, index) => (line.who === 'you' ? [index] : []))
}

/** What the user says, in the language being learnt: the segments of the dialogue's hidden text. */
export function dialogueSegments(dialogue: Dialogue, lang: Lang): string[] {
  return userLines(dialogue).map((index) => parseGloss(dialogue.lines[index]!.text[lang]).plain)
}

export interface Turn {
  /** Script index of the user's line; undefined once every turn is over. */
  line: number | undefined
  /** Bot lines said before it (since the previous user line) — or, at the end, after the last one. */
  opening: number[]
}

/** The user's turn `turn` (0-based) and the bot lines that lead up to it. */
export function turnAt(dialogue: Dialogue, turn: number): Turn {
  const lines = userLines(dialogue)
  const line = lines[turn]
  const from = turn > 0 ? (lines[Math.min(turn, lines.length) - 1] ?? -1) + 1 : 0
  const to = line ?? dialogue.lines.length
  const opening: number[] = []
  for (let i = from; i < to; i++) if (dialogue.lines[i]?.who === 'bot') opening.push(i)
  return { line, opening }
}

/** Lines before this index were said in earlier turns (already on screen when the turn starts). */
export function historyEnd(dialogue: Dialogue, turn: number): number {
  const { line, opening } = turnAt(dialogue, turn)
  return opening[0] ?? line ?? dialogue.lines.length
}

/** The dialogue to offer after `current`: the next one not finished yet (wrapping round), else simply the next. */
export function nextDialogueKey(keys: readonly string[], current: string, finished: ReadonlySet<string>): string | undefined {
  if (keys.length === 0) return undefined
  const start = keys.indexOf(current)
  const after = Array.from({ length: keys.length }, (_, i) => keys[(start + 1 + i) % keys.length]!)
  if (start === -1) return after.find((key) => !finished.has(key)) ?? keys[0]
  return after.find((key) => key !== current && !finished.has(key)) ?? after[0]
}
