import { describe, expect, it } from 'vitest'
import * as gamification from '@/domain/gamification'
import {
  ACHIEVEMENT_RULES,
  buildGlobalMetrics,
  buildTextMetrics,
  type DailyStatsLike,
  evaluateAchievements,
  levelInfo,
  type TextStatsLike,
} from '@/domain/gamification'
import { rangeDays } from '@/domain/time/dayKey'

describe('gamification entry point', () => {
  it('exposes the whole domain API', () => {
    expect(Object.keys(gamification)).toEqual(
      expect.arrayContaining([
        'XP_RULES',
        'TIER_XP',
        'streakMultiplier',
        'segmentXp',
        'textCompletionXp',
        'MAX_NAMED_LEVEL',
        'thresholdForLevel',
        'levelInfo',
        'toRoman',
        'MAX_FREEZES',
        'FREEZE_EVERY',
        'computeStreak',
        'reconcileFreezes',
        'freezeAward',
        'isComeback',
        'weeklyRhythmBest',
        'nextTextDayStreak',
        'dayMarksFrom',
        'buildGlobalMetrics',
        'buildTextMetrics',
        'ACHIEVEMENT_RULES',
        'achievementKey',
        'evaluateAchievements',
        'ruleProgress',
        'nextTextMilestone',
      ]),
    )
  })
})

describe('from stats to unlocked achievements', () => {
  it('unlocks what a first week of daily practice has earned', () => {
    const today = '2026-09-25'
    const daily: DailyStatsLike[] = rangeDays('2026-09-19', today).map((dayKey) => ({
      dayKey,
      segmentsAccepted: 12,
      sessionsCompleted: 1,
      goalReached: true,
      frozen: false,
      langs: dayKey === today ? ['pl', 'en'] : ['pl'],
      morning: false,
      evening: false,
    }))
    const global = buildGlobalMetrics({
      daily,
      game: { perfectSessions: 0, fullSessions: 0, comebacks: 0 },
      ownTexts: 1,
      level: levelInfo(3200).level,
      today,
    })
    const ourFather: TextStatsLike = {
      repetitions: 7,
      bestDayStreak: 7,
      perfectRuns: 1,
      bestConsecutiveFirstTry: 3,
      memoryRuns: 0,
    }
    const ownAffirmation: TextStatsLike = {
      repetitions: 1,
      bestDayStreak: 1,
      perfectRuns: 0,
      bestConsecutiveFirstTry: 1,
      memoryRuns: 0,
    }
    const texts = [
      { textId: 'our-father', metrics: buildTextMetrics(ourFather, 5) },
      { textId: 'own-1', metrics: buildTextMetrics(ownAffirmation, 1) },
    ]

    const unlocks = evaluateAchievements({
      rules: ACHIEVEMENT_RULES,
      global,
      texts,
      unlocked: new Set(),
    })

    expect(unlocks.map((unlock) => unlock.key).sort()).toEqual([
      'bilingual',
      'create.1',
      'daily.10',
      'session.first',
      'streak.2',
      'streak.5',
      'streak.7',
      'text.perfect:our-father',
      'text.reps.1:our-father',
      'text.reps.1:own-1',
      'text.reps.7:our-father',
      'text.streak.3:our-father',
      'text.streak.7:our-father',
    ])
  })
})
