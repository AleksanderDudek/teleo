import type { Lang } from '@/domain/types'
import { isNearMatch, soundKey, stripDiacritics } from './similarity'
import type { OpEntry } from './types'

type DiagonalOp = 'match' | 'near' | 'wrong'

/** A word with its diacritic-free and sound forms, computed once per word instead of once per DP cell. */
interface Word {
  text: string
  bare: string
  sound: string
}

/**
 * Costs scaled ×10 so the DP compares integers only (near 0.2, wrong 1.5).
 * A substitution is cheaper than missing + extra, so a misheard word reads as
 * one wrong word rather than two errors. A skipped word (live mode: the previous
 * sentence repeated at the start of the window) is dearer than a match, so a
 * genuine repetition is never swallowed.
 */
const COST = { match: 0, near: 2, wrong: 15, missing: 10, extra: 10, skip: 5, join: 2 } as const
const SCALE = 10

function toWord(text: string, lang: Lang | undefined): Word {
  const bare = stripDiacritics(text)
  return { text, bare, sound: lang ? soundKey(text, lang) : bare }
}

/** Same verdict as `compareWords`, plus the sound key: a non-match reads as a substitution. */
function diagonalOp(source: Word, spoken: Word): DiagonalOp {
  if (source.text === spoken.text) return 'match'
  return source.sound === spoken.sound || isNearMatch(source.bare, spoken.bare) ? 'near' : 'wrong'
}

/**
 * Recognisers split and merge words (`niekształtowna` → `nie kształtowna`, `w niebie` → `wniebie`). One
 * word written as two, or two as one, counts as said when the pieces make up exactly that word — ignoring
 * only diacritics and spellings of the same sound, never other letters: a short extra word glued to its
 * neighbour must stay an extra word.
 */
function joinedOp(whole: Word, first: Word, second: Word): 'match' | 'near' | null {
  if (first.text + second.text === whole.text) return 'match'
  return first.bare + second.bare === whole.bare || first.sound + second.sound === whole.sound ? 'near' : null
}

/** Every cell of the alignment DP, so any source/spoken prefix pair can be read back. */
export interface AlignmentTable {
  /** Cheapest cost (×10) of aligning source[0..i) with spoken[0..j). */
  cost(i: number, j: number): number
  /** That alignment's ops in source order; skipped leading words are left out. */
  ops(i: number, j: number): OpEntry[]
}

/**
 * Word-level edit distance (Needleman–Wunsch) with backtracking, plus two joins: one source word said as
 * two spoken words, and two source words said as one. The first `skippable` spoken words may instead be
 * skipped, before any source word. `lang` enables that language's sound keys.
 */
export function alignmentTable(
  source: readonly string[],
  spoken: readonly string[],
  skippable = 0,
  lang?: Lang,
): AlignmentTable {
  const sourceWords = source.map((text) => toWord(text, lang))
  const spokenWords = spoken.map((text) => toWord(text, lang))
  // Split: source word i-1 said as spoken j-2 + j-1. Merge: source i-2 + i-1 said as spoken j-1.
  const split = (i: number, j: number) => {
    const whole = sourceWords[i - 1]
    const first = spokenWords[j - 2]
    const second = spokenWords[j - 1]
    return whole && first && second ? joinedOp(whole, first, second) : null
  }
  const merge = (i: number, j: number) => {
    const first = sourceWords[i - 2]
    const second = sourceWords[i - 1]
    const whole = spokenWords[j - 1]
    return whole && first && second ? joinedOp(whole, first, second) : null
  }
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
        split(i, j) ? cost(i - 1, j - 2) + COST.join : Infinity,
        merge(i, j) ? cost(i - 2, j - 1) + COST.join : Infinity,
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
        const splitOp = split(i, j)
        if (splitOp && here === cost(i - 1, j - 2) + COST.join) {
          const spokenText = `${spokenWords[j - 2]?.text} ${spokenWord.text}`
          result.push({ op: splitOp, source: sourceWord.text, spoken: spokenText, sourceIndex: i - 1 })
          i--
          j -= 2
          continue
        }
        const mergeOp = merge(i, j)
        if (mergeOp && here === cost(i - 2, j - 1) + COST.join) {
          result.push({ op: mergeOp, source: sourceWord.text, spoken: spokenWord.text, sourceIndex: i - 1 })
          result.push({ op: mergeOp, source: sourceWords[i - 2]?.text, spoken: spokenWord.text, sourceIndex: i - 2 })
          i -= 2
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
  lang?: Lang,
): { ops: OpEntry[]; cost: number } {
  const table = alignmentTable(source, spoken, 0, lang)
  return {
    ops: table.ops(source.length, spoken.length),
    cost: table.cost(source.length, spoken.length) / SCALE,
  }
}
