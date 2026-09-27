import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Tier } from '@/domain/types'
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_RULES,
  type AchievementCategory,
  achievementKey,
  type AchievementRule,
  type AchievementUnlock,
  evaluateAchievements,
  isAchievementRule,
  nextTextMilestone,
  parseAchievementRules,
  ruleProgress,
} from './achievements'
import {
  GLOBAL_METRICS,
  type GlobalMetric,
  isGlobalMetric,
  isTextMetric,
  TEXT_METRICS,
  type TextMetric,
} from './metrics'

type SpecRow<M> = [
  id: string,
  metric: M,
  threshold: number,
  tier: Tier,
  category: AchievementCategory,
]

/** Spec §9.5 — applied to every text. */
const SPEC_TEXT_RULES: SpecRow<TextMetric>[] = [
  ['text.reps.1', 'textRepetitions', 1, 'bronze', 'text'],
  ['text.reps.7', 'textRepetitions', 7, 'bronze', 'text'],
  ['text.reps.21', 'textRepetitions', 21, 'silver', 'text'],
  ['text.reps.50', 'textRepetitions', 50, 'silver', 'text'],
  ['text.reps.100', 'textRepetitions', 100, 'gold', 'text'],
  ['text.reps.365', 'textRepetitions', 365, 'platinum', 'text'],
  ['text.reps.1000', 'textRepetitions', 1000, 'diamond', 'text'],
  ['text.streak.3', 'textBestDayStreak', 3, 'bronze', 'text'],
  ['text.streak.7', 'textBestDayStreak', 7, 'silver', 'text'],
  ['text.streak.30', 'textBestDayStreak', 30, 'gold', 'text'],
  ['text.streak.100', 'textBestDayStreak', 100, 'platinum', 'text'],
  ['text.perfect', 'textFlawless', 1, 'silver', 'text'],
  ['text.memory', 'textMemoryRuns', 1, 'gold', 'text'],
]

/** Spec §9.6. */
const SPEC_GLOBAL_RULES: SpecRow<GlobalMetric>[] = [
  ['streak.2', 'bestStreak', 2, 'bronze', 'streak'],
  ['streak.5', 'bestStreak', 5, 'bronze', 'streak'],
  ['streak.7', 'bestStreak', 7, 'silver', 'streak'],
  ['streak.14', 'bestStreak', 14, 'silver', 'streak'],
  ['streak.30', 'bestStreak', 30, 'gold', 'streak'],
  ['streak.60', 'bestStreak', 60, 'gold', 'streak'],
  ['streak.100', 'bestStreak', 100, 'platinum', 'streak'],
  ['streak.365', 'bestStreak', 365, 'diamond', 'streak'],
  ['weekly.5of7.x4', 'weeklyRhythmBest', 4, 'gold', 'consistency'],
  ['goal.days.30', 'goalDays', 30, 'gold', 'consistency'],
  ['daily.10', 'dailyMax', 10, 'bronze', 'daily'],
  ['daily.25', 'dailyMax', 25, 'bronze', 'daily'],
  ['daily.50', 'dailyMax', 50, 'silver', 'daily'],
  ['daily.100', 'dailyMax', 100, 'gold', 'daily'],
  ['daily.150', 'dailyMax', 150, 'platinum', 'daily'],
  ['total.100', 'totalSegments', 100, 'bronze', 'volume'],
  ['total.500', 'totalSegments', 500, 'silver', 'volume'],
  ['total.1000', 'totalSegments', 1000, 'gold', 'volume'],
  ['total.5000', 'totalSegments', 5000, 'platinum', 'volume'],
  ['total.10000', 'totalSegments', 10000, 'diamond', 'volume'],
  ['total.50000', 'totalSegments', 50000, 'diamond', 'volume'],
  ['session.first', 'sessionsCompleted', 1, 'bronze', 'sessions'],
  ['session.10', 'sessionsCompleted', 10, 'bronze', 'sessions'],
  ['session.50', 'sessionsCompleted', 50, 'silver', 'sessions'],
  ['session.100', 'sessionsCompleted', 100, 'gold', 'sessions'],
  ['session.perfect', 'perfectSessions', 1, 'silver', 'sessions'],
  ['session.long', 'fullSessions', 1, 'gold', 'sessions'],
  ['time.morning.7', 'morningDays', 7, 'silver', 'time'],
  ['time.evening.7', 'eveningDays', 7, 'silver', 'time'],
  ['create.1', 'ownTexts', 1, 'bronze', 'other'],
  ['create.5', 'ownTexts', 5, 'silver', 'other'],
  ['bilingual', 'bilingualDays', 1, 'silver', 'other'],
  ['comeback', 'comebacks', 1, 'bronze', 'other'],
  ['level.5', 'level', 5, 'silver', 'level'],
  ['level.10', 'level', 10, 'gold', 'level'],
  ['level.20', 'level', 20, 'diamond', 'level'],
]

/** Owner request 2026-09-27: the golden quarter-hour and the Bible challenge (DECISIONS). */
const ADDED_GLOBAL_RULES: SpecRow<GlobalMetric>[] = [
  ['golden.days.1', 'goldenDays', 1, 'bronze', 'golden'],
  ['golden.days.7', 'goldenDays', 7, 'silver', 'golden'],
  ['golden.days.30', 'goldenDays', 30, 'gold', 'golden'],
  ['golden.days.100', 'goldenDays', 100, 'platinum', 'golden'],
  ['golden.days.365', 'goldenDays', 365, 'diamond', 'golden'],
  ['bible.readings.1', 'bibleReadings', 1, 'bronze', 'bible'],
  ['bible.readings.7', 'bibleReadings', 7, 'bronze', 'bible'],
  ['bible.readings.30', 'bibleReadings', 30, 'silver', 'bible'],
  ['bible.readings.100', 'bibleReadings', 100, 'silver', 'bible'],
  ['bible.readings.365', 'bibleReadings', 365, 'gold', 'bible'],
  ['bible.readings.1000', 'bibleReadings', 1000, 'platinum', 'bible'],
  ['bible.books.1', 'bibleBooks', 1, 'silver', 'bible'],
  ['bible.books.10', 'bibleBooks', 10, 'gold', 'bible'],
  ['bible.nt', 'bibleNewTestament', 1, 'platinum', 'bible'],
  ['bible.ot', 'bibleOldTestament', 1, 'platinum', 'bible'],
  ['bible.whole', 'bibleWhole', 1, 'diamond', 'bible'],
]

const SPEC_HIDDEN = ['comeback', 'time.evening.7', 'time.morning.7']

function specRule(scope: 'global' | 'text') {
  return ([id, metric, threshold, tier, category]: SpecRow<GlobalMetric | TextMetric>) => ({
    id,
    scope,
    metric,
    threshold,
    tier,
    category,
    ...(SPEC_HIDDEN.includes(id) ? { hidden: true } : {}),
  })
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)
const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : 1)

function rule(id: string): AchievementRule {
  const found = ACHIEVEMENT_RULES.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No rule ${id}`)
  return found
}

function globalMetrics(values: Partial<Record<GlobalMetric, number>> = {}) {
  const zero = Object.fromEntries(GLOBAL_METRICS.map((metric) => [metric, 0]))
  return { ...(zero as Record<GlobalMetric, number>), ...values }
}

function textMetrics(values: Partial<Record<TextMetric, number>> = {}): Record<TextMetric, number> {
  return { textRepetitions: 0, textBestDayStreak: 0, textFlawless: 0, textMemoryRuns: 0, ...values }
}

describe('ACHIEVEMENT_RULES', () => {
  it('defines every rule of spec §9.5–9.6 exactly once', () => {
    const ids = ACHIEVEMENT_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const expected = [
      ...SPEC_TEXT_RULES.map(specRule('text')),
      ...SPEC_GLOBAL_RULES.map(specRule('global')),
      ...ADDED_GLOBAL_RULES.map(specRule('global')),
    ]
    expect(ACHIEVEMENT_RULES).toHaveLength(65)
    expect([...ACHIEVEMENT_RULES].sort(byId)).toEqual(expected.sort(byId))
  })

  it('measures text rules with text metrics and global rules with global metrics', () => {
    const mismatched = ACHIEVEMENT_RULES.filter((r) =>
      r.scope === 'text' ? !isTextMetric(r.metric) : !isGlobalMetric(r.metric),
    )
    expect(mismatched).toEqual([])
  })

  it('ties the metric type to the scope', () => {
    type GlobalRule = Extract<AchievementRule, { scope: 'global' }>
    type TextRule = Extract<AchievementRule, { scope: 'text' }>
    expectTypeOf<GlobalRule['metric']>().toEqualTypeOf<GlobalMetric>()
    expectTypeOf<TextRule['metric']>().toEqualTypeOf<TextMetric>()
  })

  it('uses every metric in at least one rule', () => {
    const measured = new Set(ACHIEVEMENT_RULES.map((r) => r.metric))
    expect([...GLOBAL_METRICS, ...TEXT_METRICS].filter((m) => !measured.has(m))).toEqual([])
  })

  it('hides only the surprise achievements', () => {
    const hidden = ACHIEVEMENT_RULES.filter((r) => r.hidden === true).map((r) => r.id)
    expect(hidden.sort()).toEqual(SPEC_HIDDEN)
  })

  it('groups rules into the known categories', () => {
    expect(ACHIEVEMENT_CATEGORIES).toEqual([
      'text',
      'streak',
      'consistency',
      'daily',
      'volume',
      'sessions',
      'time',
      'other',
      'level',
      'golden',
      'bible',
    ])
  })
})

describe('parseAchievementRules', () => {
  const VALID = {
    id: 'custom.rule',
    scope: 'global',
    metric: 'bestStreak',
    threshold: 3,
    tier: 'bronze',
    category: 'streak',
  }

  it('accepts well-formed rules', () => {
    const textRule = {
      ...VALID,
      id: 'custom.text',
      scope: 'text',
      metric: 'textRepetitions',
      category: 'text',
      hidden: true,
    }
    expect(parseAchievementRules([VALID, textRule])).toEqual([VALID, textRule])
    expect(isAchievementRule(VALID)).toBe(true)
  })

  it('rejects anything but an array', () => {
    expect(() => parseAchievementRules(VALID)).toThrow(TypeError)
  })

  it.each([
    ['no id', { ...VALID, id: undefined }],
    ['an empty id', { ...VALID, id: '' }],
    ['an unknown scope', { ...VALID, scope: 'user' }],
    ['an unknown metric', { ...VALID, metric: 'streak' }],
    ['a text metric in a global rule', { ...VALID, metric: 'textRepetitions' }],
    ['a global metric in a text rule', { ...VALID, scope: 'text', category: 'text' }],
    ['a zero threshold', { ...VALID, threshold: 0 }],
    ['a text threshold', { ...VALID, threshold: '3' }],
    ['an infinite threshold', { ...VALID, threshold: Number.POSITIVE_INFINITY }],
    ['an unknown tier', { ...VALID, tier: 'copper' }],
    ['an unknown category', { ...VALID, category: 'misc' }],
    ['a non-boolean hidden flag', { ...VALID, hidden: 'yes' }],
    ['a misspelled key', { ...VALID, hiden: true }],
    ['no object at all', null],
  ])('rejects a rule with %s', (_, invalid) => {
    expect(isAchievementRule(invalid)).toBe(false)
    expect(() => parseAchievementRules([VALID, { ...VALID, id: 'other' }, invalid])).toThrow(
      /index 2/,
    )
  })

  it('rejects duplicate ids', () => {
    expect(() => parseAchievementRules([VALID, { ...VALID }])).toThrow(/duplicate.*custom\.rule/i)
  })
})

describe('achievementKey', () => {
  it('uses the rule id for global rules and appends the text id for text rules', () => {
    expect(achievementKey('streak.7')).toBe('streak.7')
    expect(achievementKey('text.reps.100', 'our-father')).toBe('text.reps.100:our-father')
  })
})

describe('evaluateAchievements', () => {
  const streakRules = ACHIEVEMENT_RULES.filter((r) => r.metric === 'bestStreak')
  const evaluateStreak = (bestStreak: number) =>
    evaluateAchievements({
      rules: streakRules,
      global: globalMetrics({ bestStreak }),
      texts: [],
      unlocked: new Set(),
    })

  it('unlocks a global rule once its metric reaches the threshold', () => {
    expect(evaluateStreak(4)).toStrictEqual([
      { key: 'streak.2', ruleId: 'streak.2', tier: 'bronze' },
    ])
    expect(evaluateStreak(5)).toStrictEqual([
      { key: 'streak.2', ruleId: 'streak.2', tier: 'bronze' },
      { key: 'streak.5', ruleId: 'streak.5', tier: 'bronze' },
    ])
  })

  it('unlocks nothing for a fresh user', () => {
    const result = evaluateAchievements({
      rules: ACHIEVEMENT_RULES,
      global: globalMetrics({ level: 1 }),
      texts: [{ textId: 'our-father', metrics: textMetrics() }],
      unlocked: new Set(),
    })
    expect(result).toEqual([])
  })

  it('never returns achievements that are already unlocked', () => {
    const input = {
      rules: ACHIEVEMENT_RULES,
      global: globalMetrics({ bestStreak: 7, totalSegments: 120 }),
      texts: [{ textId: 't1', metrics: textMetrics({ textRepetitions: 3 }) }],
      unlocked: new Set(['streak.2']),
    }
    const first = evaluateAchievements(input)
    expect(first.map((u) => u.key).sort()).toEqual([
      'streak.5',
      'streak.7',
      'text.reps.1:t1',
      'total.100',
    ])
    const unlocked = new Set([...input.unlocked, ...first.map((u) => u.key)])
    expect(evaluateAchievements({ ...input, unlocked })).toEqual([])
  })

  it('evaluates text rules for every text, including a brand-new one', () => {
    const ourFather = textMetrics({ textRepetitions: 120, textBestDayStreak: 3 })
    const texts = [
      { textId: 'our-father', metrics: ourFather },
      { textId: 'brand-new', metrics: textMetrics({ textRepetitions: 1 }) },
    ]
    const unlocked = new Set(
      ['text.reps.1', 'text.reps.7', 'text.reps.21', 'text.reps.50'].map((id) =>
        achievementKey(id, 'our-father'),
      ),
    )
    const result = evaluateAchievements({
      rules: ACHIEVEMENT_RULES,
      global: globalMetrics(),
      texts,
      unlocked,
    })
    const unlock = (ruleId: string, textId: string, tier: Tier): AchievementUnlock => ({
      key: `${ruleId}:${textId}`,
      ruleId,
      textId,
      tier,
    })
    const expected = [
      unlock('text.reps.100', 'our-father', 'gold'),
      unlock('text.streak.3', 'our-father', 'bronze'),
      unlock('text.reps.1', 'brand-new', 'bronze'),
    ]
    expect(result.sort(byKey)).toStrictEqual(expected.sort(byKey))
  })
})

describe('ruleProgress', () => {
  it('reports progress towards the threshold', () => {
    const centurion = rule('text.reps.100')
    expect(ruleProgress(centurion, 88)).toEqual({ current: 88, threshold: 100, ratio: 0.88 })
    expect(ruleProgress(centurion, 0)).toEqual({ current: 0, threshold: 100, ratio: 0 })
  })

  it('caps the current value at the threshold', () => {
    expect(ruleProgress(rule('streak.7'), 12)).toEqual({ current: 7, threshold: 7, ratio: 1 })
  })

  it('keeps current within 0…threshold and the ratio within 0…1 for odd values', () => {
    const centurion = rule('text.reps.100')
    expect(ruleProgress(centurion, -5)).toEqual({ current: 0, threshold: 100, ratio: 0 })
    expect(ruleProgress(centurion, Number.NaN)).toEqual({ current: 0, threshold: 100, ratio: 0 })
    const infinite = ruleProgress(centurion, Number.POSITIVE_INFINITY)
    expect(infinite).toEqual({ current: 100, threshold: 100, ratio: 1 })
  })
})

describe('nextTextMilestone', () => {
  const next = (textRepetitions: number, rules: readonly AchievementRule[] = ACHIEVEMENT_RULES) =>
    nextTextMilestone(textMetrics({ textRepetitions }), rules)

  it('names the next repetition milestone and how many repetitions are left', () => {
    expect(next(88)).toEqual({ rule: rule('text.reps.100'), remaining: 12 })
    expect(next(0)).toEqual({ rule: rule('text.reps.1'), remaining: 1 })
    expect(next(7)).toEqual({ rule: rule('text.reps.21'), remaining: 14 })
  })

  it('is null once every repetition milestone is reached', () => {
    expect(next(1000)).toBeNull()
    expect(next(1500)).toBeNull()
  })

  it('does not depend on the order of the rules', () => {
    expect(next(88, [...ACHIEVEMENT_RULES].reverse())?.rule.id).toBe('text.reps.100')
  })

  it('only considers repetition rules', () => {
    const others = ACHIEVEMENT_RULES.filter((r) => r.metric !== 'textRepetitions')
    expect(next(88, others)).toBeNull()
  })
})
