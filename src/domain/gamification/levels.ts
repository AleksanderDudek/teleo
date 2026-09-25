/** Last level with its own name ("Teleo", spec §9.3); circles I, II, III… follow. */
export const MAX_NAMED_LEVEL = 20
/** XP per circle after the last named level. */
export const CIRCLE_XP = 25_000

export interface LevelInfo {
  level: number
  /** 0 up to level 20, then 1 for level 21 (Teleo I), 2 for level 22 (Teleo II)… */
  circle: number
  /** Cumulative XP at which the current level starts. */
  currentThreshold: number
  /** Cumulative XP at which the next level starts. */
  nextThreshold: number
  /** XP earned since `currentThreshold`. */
  xpIntoLevel: number
  /** Size of the current level: `nextThreshold − currentThreshold`. */
  xpForNext: number
  /** `xpIntoLevel / xpForNext`, 0 ≤ progress < 1. */
  progress: number
}

/** Cumulative XP needed for `level`: `250·n·(n−1)` up to level 20, then +25 000 per circle. */
export function thresholdForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`Invalid level: ${level}`)
  if (level <= MAX_NAMED_LEVEL) return 250 * level * (level - 1)
  return thresholdForLevel(MAX_NAMED_LEVEL) + CIRCLE_XP * (level - MAX_NAMED_LEVEL)
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, totalXp)
  const lastNamedThreshold = thresholdForLevel(MAX_NAMED_LEVEL)
  let level = 1
  if (xp >= lastNamedThreshold) {
    level = MAX_NAMED_LEVEL + Math.floor((xp - lastNamedThreshold) / CIRCLE_XP)
  } else {
    while (thresholdForLevel(level + 1) <= xp) level++
  }
  const currentThreshold = thresholdForLevel(level)
  const nextThreshold = thresholdForLevel(level + 1)
  const xpIntoLevel = xp - currentThreshold
  const xpForNext = nextThreshold - currentThreshold
  return {
    level,
    circle: Math.max(0, level - MAX_NAMED_LEVEL),
    currentThreshold,
    nextThreshold,
    xpIntoLevel,
    xpForNext,
    progress: xpIntoLevel / xpForNext,
  }
}

const ROMAN_NUMERALS: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

/** Roman numeral for 1–3999 (used for circles: Teleo I, II, III…). */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) {
    throw new RangeError(`Cannot write ${n} as a Roman numeral`)
  }
  let rest = n
  let roman = ''
  for (const [value, symbol] of ROMAN_NUMERALS) {
    while (rest >= value) {
      roman += symbol
      rest -= value
    }
  }
  return roman
}
