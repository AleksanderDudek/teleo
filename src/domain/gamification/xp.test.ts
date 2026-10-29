import { describe, expect, it } from 'vitest'
import { FIRST_TRY_COVERAGE, GOLDEN_WINDOW, goldenMultiplier, isCleanFirstTry, segmentXp, streakMultiplier, textCompletionXp, TIER_XP, XP_RULES } from './xp'

describe('XP constants', () => {
  it('match the XP table of spec §9.2', () => {
    expect(XP_RULES).toEqual({
      segmentBase: 5,
      segmentCap: 30,
      firstTryBonus: 2,
      textCompleteRatio: 0.2,
      sessionComplete: 25,
      dailyGoal: 50,
    })
  })

  it('reward achievement tiers per spec §9.4', () => {
    expect(TIER_XP).toEqual({ bronze: 50, silver: 100, gold: 250, platinum: 500, diamond: 1000 })
  })
})

describe('streakMultiplier', () => {
  it.each([
    [0, 1],
    [2, 1],
    [3, 1.1],
    [6, 1.1],
    [7, 1.25],
    [29, 1.25],
    [30, 1.5],
    [400, 1.5],
  ])('streak %i → ×%s', (streak, multiplier) => {
    expect(streakMultiplier(streak)).toBe(multiplier)
  })
})

describe('segmentXp', () => {
  it('gives 5 XP plus one per word', () => {
    expect(segmentXp(3, false, 0)).toEqual({ base: 8, bonus: 0, multiplier: 1, golden: 1, accuracy: 1, total: 8 })
  })

  it('caps the word-based part at 30', () => {
    expect(segmentXp(30, false, 0).total).toBe(30)
    expect(segmentXp(25, false, 0).base).toBe(30)
  })

  it('adds the first-try bonus on top of the cap', () => {
    expect(segmentXp(25, true, 0)).toEqual({ base: 30, bonus: 2, multiplier: 1, golden: 1, accuracy: 1, total: 32 })
  })

  it('treats a negative word count as 0', () => {
    expect(segmentXp(-3, false, 0)).toEqual({ base: 5, bonus: 0, multiplier: 1, golden: 1, accuracy: 1, total: 5 })
  })

  it('multiplies base and bonus by the streak multiplier and rounds', () => {
    expect(segmentXp(5, true, 3)).toEqual({ base: 10, bonus: 2, multiplier: 1.1, golden: 1, accuracy: 1, total: 13 })
    expect(segmentXp(30, true, 30).total).toBe(48)
  })
})

describe('segmentXp follows accuracy (DECISIONS #133)', () => {
  it('pays the share of the sentence that was said: all of it for 100 %, 60 % for 60 %', () => {
    expect(segmentXp(5, false, 0, 0, 1).total).toBe(10)
    expect(segmentXp(5, false, 0, 0, 0.6)).toEqual({ base: 10, bonus: 0, multiplier: 1, golden: 1, accuracy: 0.6, total: 6 })
    expect(segmentXp(25, true, 7, 0, 0.8).total).toBe(Math.round(32 * 0.8 * 1.25))
  })

  it('keeps accuracy within 0…1', () => {
    expect(segmentXp(5, false, 0, 0, 1.4).accuracy).toBe(1)
    expect(segmentXp(5, false, 0, 0, -1).total).toBe(0)
    expect(segmentXp(5, false, 0, 0, Number.NaN).total).toBe(0)
  })
})

describe('isCleanFirstTry', () => {
  it('needs the first attempt to pass with at least 90 % of the words, whatever the way of checking', () => {
    expect(FIRST_TRY_COVERAGE).toBe(0.9)
    expect(isCleanFirstTry(true, 1, 0.9)).toBe(true)
    expect(isCleanFirstTry(true, 1, 0.6)).toBe(false)
    expect(isCleanFirstTry(true, 2, 1)).toBe(false)
    expect(isCleanFirstTry(false, 1, 1)).toBe(false)
  })
})

describe('goldenMultiplier (the golden quarter-hour)', () => {
  const min = 60_000
  it('opens at 5 minutes of reading and closes at 15', () => {
    expect(GOLDEN_WINDOW).toEqual({ startMs: 5 * min, endMs: 15 * min, multiplier: 2 })
  })

  it.each([
    [0, 1],
    [4.99 * min, 1],
    [5 * min, 2],
    [10 * min, 2],
    [14.99 * min, 2],
    [15 * min, 1],
    [90 * min, 1],
  ])('%i ms read today → ×%s', (readingMs, multiplier) => {
    expect(goldenMultiplier(readingMs)).toBe(multiplier)
  })
})

describe('segmentXp in the golden quarter-hour', () => {
  it('doubles the sentence XP, on top of the streak multiplier', () => {
    expect(segmentXp(5, true, 3, 6 * 60_000)).toEqual({ base: 10, bonus: 2, multiplier: 1.1, golden: 2, accuracy: 1, total: 26 })
  })

  it('is plain XP before and after the window', () => {
    expect(segmentXp(5, false, 0, 60_000).total).toBe(10)
    expect(segmentXp(5, false, 0, 20 * 60_000).total).toBe(10)
  })
})

describe('textCompletionXp', () => {
  it('awards 20% of the segment XP of the completed text, rounded', () => {
    expect(textCompletionXp(47)).toBe(9)
    expect(textCompletionXp(48)).toBe(10)
    expect(textCompletionXp(0)).toBe(0)
  })
})
