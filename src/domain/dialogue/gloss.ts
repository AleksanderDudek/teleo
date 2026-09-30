/**
 * Word links of a dialogue line (owner request 2026-09-30, DECISIONS #102). A line is written with inline
 * markup: `{word(s)|id}` links the words to the words with the same id in the other language, e.g.
 * `{I|s1}{’d like|v1} a {coffee|o1}.` ↔ `{Poproszę|v1,s1} {kawę|o1}.` The id's letter is the grammatical
 * role; a word may carry several ids (Polish puts the subject into the verb ending). Pure module.
 */

export type GlossRole = 'subject' | 'predicate' | 'adjective' | 'object'
export const GLOSS_ROLES = ['subject', 'predicate', 'adjective', 'object'] as const satisfies readonly GlossRole[]

const ROLE_BY_LETTER: Readonly<Record<string, GlossRole>> = { s: 'subject', v: 'predicate', a: 'adjective', o: 'object' }
const ID = /^([svao])\d+$/

export interface GlossPart {
  text: string
  /** Link ids of these words; empty for the text between links. */
  ids: readonly string[]
  /** Role of the first id (the colour the words are shown in). */
  role?: GlossRole
}

export interface Gloss {
  /** The line as said and shown: the markup without braces and ids. */
  plain: string
  parts: GlossPart[]
}

export class GlossError extends Error {
  constructor(message: string, markup: string) {
    super(`${message}: ${markup}`)
    this.name = 'GlossError'
  }
}

export function roleOf(id: string): GlossRole {
  const role = ROLE_BY_LETTER[id.charAt(0)]
  if (!role || !ID.test(id)) throw new GlossError('unknown id', id)
  return role
}

export function parseGloss(markup: string): Gloss {
  const parts: GlossPart[] = []
  const pushPlain = (text: string) => {
    if (text.includes('|') || text.includes('}')) throw new GlossError('stray link markup', markup)
    if (text) parts.push({ text, ids: [] })
  }
  let at = 0
  while (at < markup.length) {
    const open = markup.indexOf('{', at)
    if (open === -1) {
      pushPlain(markup.slice(at))
      break
    }
    pushPlain(markup.slice(at, open))
    const close = markup.indexOf('}', open)
    if (close === -1) throw new GlossError('link not closed', markup)
    const inner = markup.slice(open + 1, close)
    if (inner.includes('{')) throw new GlossError('nested link', markup)
    const bar = inner.indexOf('|')
    if (bar === -1) throw new GlossError('link with no id', markup)
    const text = inner.slice(0, bar)
    if (!text.trim()) throw new GlossError('empty link', markup)
    const ids = inner
      .slice(bar + 1)
      .split(',')
      .map((id) => id.trim())
    for (const id of ids) if (!ID.test(id)) throw new GlossError('unknown id', markup)
    parts.push({ text, ids, role: roleOf(ids[0]!) })
    at = close + 1
  }
  return { plain: parts.map((part) => part.text).join(''), parts }
}

/** Every link id of a line. */
export function glossIds(gloss: Gloss): Set<string> {
  return new Set(gloss.parts.flatMap((part) => part.ids))
}
