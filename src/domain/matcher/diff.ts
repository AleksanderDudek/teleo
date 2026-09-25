import type { Lang } from '@/domain/types'
import { normalize, rawWords } from './normalize'
import type { DiffPart, DiffStatus, MatchResult } from './types'

/** When tokens share a raw word ("I'm" → i + am), the worst status wins. */
const SEVERITY: Record<DiffStatus, number> = { none: 0, match: 1, near: 2, wrong: 3, missing: 4 }

/** Key for spoken words said before the first source word. */
const BEFORE_FIRST = -1

/**
 * The source exactly as written, one part per whitespace-separated word, coloured
 * by the alignment of `result`, with the spoken words that are not in the source
 * inserted where they were said.
 */
export function buildDiff(source: string, lang: Lang, result: MatchResult): DiffPart[] {
  const words = rawWords(source)
  const tokens = normalize(source, lang)
  const statuses: DiffStatus[] = words.map(() => 'none')
  // Spoken parts to show right after the raw word with the given index.
  const insertions = new Map<number, DiffPart[]>()
  const insertAfter = (raw: number, part: DiffPart) => {
    const parts = insertions.get(raw)
    if (parts) parts.push(part)
    else insertions.set(raw, [part])
  }

  let lastRaw = BEFORE_FIRST
  for (const entry of result.ops) {
    if (entry.op === 'extra') {
      insertAfter(lastRaw, { kind: 'spoken', text: entry.spoken ?? '', status: 'extra' })
      continue
    }
    const token = entry.sourceIndex === undefined ? undefined : tokens[entry.sourceIndex]
    if (!token) continue
    for (let raw = token.rawStart; raw <= token.rawEnd; raw++) {
      if (SEVERITY[entry.op] > SEVERITY[statuses[raw] ?? 'none']) statuses[raw] = entry.op
    }
    if (entry.op === 'wrong') {
      insertAfter(token.rawEnd, { kind: 'spoken', text: entry.spoken ?? '', status: 'wrong' })
    }
    lastRaw = Math.max(lastRaw, token.rawEnd)
  }

  return [
    ...(insertions.get(BEFORE_FIRST) ?? []),
    ...words.flatMap((text, raw): DiffPart[] => [
      { kind: 'source', text, status: statuses[raw] ?? 'none' },
      ...(insertions.get(raw) ?? []),
    ]),
  ]
}
