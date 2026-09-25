import { isNearMatch, stripDiacritics } from './similarity'
import type { OpEntry } from './types'

type DiagonalOp = 'match' | 'near' | 'wrong'

/** A word with its diacritic-free form, computed once per word instead of once per DP cell. */
interface Word {
  text: string
  bare: string
}

/**
 * Costs scaled ×10 so the DP compares integers only (near 0.2, wrong 1.5).
 * A substitution is cheaper than missing + extra, so a misheard word reads as
 * one wrong word rather than two errors.
 */
const COST = { match: 0, near: 2, wrong: 15, missing: 10, extra: 10 } as const
const SCALE = 10

const toWord = (text: string): Word => ({ text, bare: stripDiacritics(text) })

/** Same verdict as `compareWords`, with a non-match read as a substitution. */
function diagonalOp(source: Word, spoken: Word): DiagonalOp {
  if (source.text === spoken.text) return 'match'
  return isNearMatch(source.bare, spoken.bare) ? 'near' : 'wrong'
}

/**
 * Word-level edit distance (Needleman–Wunsch) with backtracking. Ops come in
 * source order, extra words at the position where they were spoken.
 */
export function align(
  source: readonly string[],
  spoken: readonly string[],
): { ops: OpEntry[]; cost: number } {
  const sourceWords = source.map(toWord)
  const spokenWords = spoken.map(toWord)
  const width = spoken.length + 1
  // table[i * width + j] = cheapest alignment of source[0..i) with spoken[0..j)
  const table = new Int32Array((source.length + 1) * width)
  const at = (i: number, j: number) => table[i * width + j] ?? 0

  for (let j = 1; j <= spoken.length; j++) table[j] = j * COST.extra
  for (const [s, sourceWord] of sourceWords.entries()) {
    const i = s + 1
    table[i * width] = i * COST.missing
    for (const [t, spokenWord] of spokenWords.entries()) {
      const j = t + 1
      table[i * width + j] = Math.min(
        at(i - 1, j - 1) + COST[diagonalOp(sourceWord, spokenWord)],
        at(i - 1, j) + COST.missing,
        at(i, j - 1) + COST.extra,
      )
    }
  }

  // Walk back from the end; on ties prefer the diagonal, then missing, then extra.
  const ops: OpEntry[] = []
  let i = source.length
  let j = spoken.length
  while (i > 0 || j > 0) {
    const sourceWord = sourceWords[i - 1]
    const spokenWord = spokenWords[j - 1]
    const cost = at(i, j)
    if (sourceWord && spokenWord) {
      const op = diagonalOp(sourceWord, spokenWord)
      if (cost === at(i - 1, j - 1) + COST[op]) {
        ops.push({ op, source: sourceWord.text, spoken: spokenWord.text, sourceIndex: i - 1 })
        i--
        j--
        continue
      }
    }
    if (sourceWord && (!spokenWord || cost === at(i - 1, j) + COST.missing)) {
      ops.push({ op: 'missing', source: sourceWord.text, sourceIndex: i - 1 })
      i--
    } else if (spokenWord) {
      ops.push({ op: 'extra', spoken: spokenWord.text })
      j--
    }
  }
  return { ops: ops.reverse(), cost: at(source.length, spoken.length) / SCALE }
}
