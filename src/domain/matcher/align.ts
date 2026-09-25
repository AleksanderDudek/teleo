import { compareWords } from './similarity'
import type { OpEntry } from './types'

type DiagonalOp = 'match' | 'near' | 'wrong'

/**
 * Costs scaled ×10 so the DP compares integers only (near 0.2, wrong 1.5).
 * A substitution is cheaper than missing + extra, so a misheard word reads as
 * one wrong word rather than two errors.
 */
const COST = { match: 0, near: 2, wrong: 15, missing: 10, extra: 10 } as const
const SCALE = 10

function diagonalOp(source: string, spoken: string): DiagonalOp {
  const similarity = compareWords(source, spoken)
  return similarity === 'none' ? 'wrong' : similarity
}

/**
 * Word-level edit distance (Needleman–Wunsch) with backtracking. Ops come in
 * source order, extra words at the position where they were spoken.
 */
export function align(
  source: readonly string[],
  spoken: readonly string[],
): { ops: OpEntry[]; cost: number } {
  const width = spoken.length + 1
  // table[i * width + j] = cheapest alignment of source[0..i) with spoken[0..j)
  const table = new Int32Array((source.length + 1) * width)
  const at = (i: number, j: number) => table[i * width + j] ?? 0

  for (let j = 1; j <= spoken.length; j++) table[j] = j * COST.extra
  for (const [s, sourceWord] of source.entries()) {
    const i = s + 1
    table[i * width] = i * COST.missing
    for (const [t, spokenWord] of spoken.entries()) {
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
    const sourceWord = source[i - 1]
    const spokenWord = spoken[j - 1]
    const cost = at(i, j)
    if (sourceWord !== undefined && spokenWord !== undefined) {
      const op = diagonalOp(sourceWord, spokenWord)
      if (cost === at(i - 1, j - 1) + COST[op]) {
        ops.push({ op, source: sourceWord, spoken: spokenWord, sourceIndex: i - 1 })
        i--
        j--
        continue
      }
    }
    if (sourceWord !== undefined && (spokenWord === undefined || cost === at(i - 1, j) + COST.missing)) {
      ops.push({ op: 'missing', source: sourceWord, sourceIndex: i - 1 })
      i--
    } else if (spokenWord !== undefined) {
      ops.push({ op: 'extra', spoken: spokenWord })
      j--
    }
  }
  return { ops: ops.reverse(), cost: at(source.length, spoken.length) / SCALE }
}
