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
 * one wrong word rather than two errors. A skipped word (live mode: the previous
 * sentence repeated at the start of the window) is dearer than a match, so a
 * genuine repetition is never swallowed.
 */
const COST = { match: 0, near: 2, wrong: 15, missing: 10, extra: 10, skip: 5 } as const
const SCALE = 10

const toWord = (text: string): Word => ({ text, bare: stripDiacritics(text) })

/** Same verdict as `compareWords`, with a non-match read as a substitution. */
function diagonalOp(source: Word, spoken: Word): DiagonalOp {
  if (source.text === spoken.text) return 'match'
  return isNearMatch(source.bare, spoken.bare) ? 'near' : 'wrong'
}

/** Every cell of the alignment DP, so any source/spoken prefix pair can be read back. */
export interface AlignmentTable {
  /** Cheapest cost (×10) of aligning source[0..i) with spoken[0..j). */
  cost(i: number, j: number): number
  /** That alignment's ops in source order; skipped leading words are left out. */
  ops(i: number, j: number): OpEntry[]
}

/**
 * Word-level edit distance (Needleman–Wunsch) with backtracking. The first
 * `skippable` spoken words may instead be skipped, before any source word.
 */
export function alignmentTable(
  source: readonly string[],
  spoken: readonly string[],
  skippable = 0,
): AlignmentTable {
  const sourceWords = source.map(toWord)
  const spokenWords = spoken.map(toWord)
  const width = spoken.length + 1
  // table[i * width + j] = cheapest alignment of source[0..i) with spoken[0..j)
  const table = new Int32Array((source.length + 1) * width)
  const cost = (i: number, j: number) => table[i * width + j] ?? 0
  const skipped = (i: number, j: number) => i === 0 && j <= skippable

  for (let j = 1; j <= spoken.length; j++) {
    table[j] = cost(0, j - 1) + (skipped(0, j) ? COST.skip : COST.extra)
  }
  sourceWords.forEach((sourceWord, s) => {
    const i = s + 1
    table[i * width] = i * COST.missing
    spokenWords.forEach((spokenWord, t) => {
      const j = t + 1
      table[i * width + j] = Math.min(
        cost(i - 1, j - 1) + COST[diagonalOp(sourceWord, spokenWord)],
        cost(i - 1, j) + COST.missing,
        cost(i, j - 1) + COST.extra,
      )
    })
  })

  // Walk back from (i, j); on ties prefer the diagonal, then missing, then extra.
  const ops = (endI: number, endJ: number): OpEntry[] => {
    const result: OpEntry[] = []
    let i = endI
    let j = endJ
    while (i > 0 || j > 0) {
      const sourceWord = sourceWords[i - 1]
      const spokenWord = spokenWords[j - 1]
      const here = cost(i, j)
      if (sourceWord && spokenWord) {
        const op = diagonalOp(sourceWord, spokenWord)
        if (here === cost(i - 1, j - 1) + COST[op]) {
          result.push({ op, source: sourceWord.text, spoken: spokenWord.text, sourceIndex: i - 1 })
          i--
          j--
          continue
        }
      }
      if (sourceWord && (!spokenWord || here === cost(i - 1, j) + COST.missing)) {
        result.push({ op: 'missing', source: sourceWord.text, sourceIndex: i - 1 })
        i--
      } else if (spokenWord) {
        if (!skipped(i, j)) result.push({ op: 'extra', spoken: spokenWord.text })
        j--
      }
    }
    return result.reverse()
  }

  return { cost, ops }
}

/**
 * Word-level edit distance between whole sequences. Ops come in source order,
 * extra words at the position where they were spoken; `cost` in spec units.
 */
export function align(
  source: readonly string[],
  spoken: readonly string[],
): { ops: OpEntry[]; cost: number } {
  const table = alignmentTable(source, spoken)
  return {
    ops: table.ops(source.length, spoken.length),
    cost: table.cost(source.length, spoken.length) / SCALE,
  }
}
