import { describe, expect, it } from 'vitest'
import { levelInfo, MAX_NAMED_LEVEL, thresholdForLevel, toRoman } from './levels'

/** Cumulative XP per named level, straight from the table in spec §9.3. */
const SPEC_THRESHOLDS = [
  0, 500, 1500, 3000, 5000, 7500, 10500, 14000, 18000, 22500, 27500, 33000, 39000, 45500, 52500,
  60000, 68000, 76500, 85500, 95000,
]

describe('thresholdForLevel', () => {
  it('matches the named levels 1–20 of spec §9.3', () => {
    expect(MAX_NAMED_LEVEL).toBe(20)
    const thresholds = SPEC_THRESHOLDS.map((_, i) => thresholdForLevel(i + 1))
    expect(thresholds).toEqual(SPEC_THRESHOLDS)
  })

  it('adds a circle every 25 000 XP after level 20', () => {
    expect(thresholdForLevel(21)).toBe(120_000)
    expect(thresholdForLevel(22)).toBe(145_000)
    expect(thresholdForLevel(30)).toBe(345_000)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects level %s', (level) => {
    expect(() => thresholdForLevel(level)).toThrow(RangeError)
  })
})

describe('levelInfo', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelInfo(0)).toEqual({
      level: 1,
      circle: 0,
      currentThreshold: 0,
      nextThreshold: 500,
      xpIntoLevel: 0,
      xpForNext: 500,
      progress: 0,
    })
  })

  it('changes level exactly at the threshold', () => {
    expect(levelInfo(499).level).toBe(1)
    expect(levelInfo(500).level).toBe(2)
    expect(levelInfo(94_999).level).toBe(19)
  })

  it('reaches Teleo (level 20) at 95 000 XP, before any circle', () => {
    expect(levelInfo(95_000)).toMatchObject({
      level: 20,
      circle: 0,
      currentThreshold: 95_000,
      nextThreshold: 120_000,
    })
  })

  it('counts circles after level 20', () => {
    expect(levelInfo(120_000)).toMatchObject({ level: 21, circle: 1, nextThreshold: 145_000 })
    expect(levelInfo(144_999)).toMatchObject({ level: 21, circle: 1 })
    expect(levelInfo(145_000)).toMatchObject({ level: 22, circle: 2 })
  })

  it('reports progress inside the current level', () => {
    expect(levelInfo(1000)).toMatchObject({
      level: 2,
      currentThreshold: 500,
      nextThreshold: 1500,
      xpIntoLevel: 500,
      xpForNext: 1000,
      progress: 0.5,
    })
    expect(levelInfo(107_500)).toMatchObject({
      level: 20,
      xpIntoLevel: 12_500,
      xpForNext: 25_000,
      progress: 0.5,
    })
  })

  it('agrees with thresholdForLevel at every boundary', () => {
    for (let level = 2; level <= 30; level++) {
      const threshold = thresholdForLevel(level)
      expect(levelInfo(threshold).level).toBe(level)
      expect(levelInfo(threshold - 1).level).toBe(level - 1)
    }
  })

  it('treats negative XP as 0', () => {
    expect(levelInfo(-50)).toEqual(levelInfo(0))
  })
})

describe('toRoman', () => {
  it.each([
    [1, 'I'],
    [4, 'IV'],
    [9, 'IX'],
    [14, 'XIV'],
    [19, 'XIX'],
    [20, 'XX'],
    [40, 'XL'],
    [90, 'XC'],
    [400, 'CD'],
    [1994, 'MCMXCIV'],
    [3999, 'MMMCMXCIX'],
  ])('%i → %s', (n, roman) => {
    expect(toRoman(n)).toBe(roman)
  })

  it.each([0, 4000, 2.5])('rejects %s', (n) => {
    expect(() => toRoman(n)).toThrow(RangeError)
  })
})
