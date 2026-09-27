import type { Tier } from '@/domain/types'
import type { GlobalMetric, TextMetric } from './metrics'
import { isGlobalMetric, isTextMetric } from './metrics'
import rulesJson from './rules.json'
import { TIER_XP } from './xp'

export const ACHIEVEMENT_CATEGORIES = [
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
] as const
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]

interface AchievementRuleBase {
  id: string
  /** Unlocks when the metric value is at least this (> 0). */
  threshold: number
  tier: Tier
  category: AchievementCategory
  /** Shown as "???" until unlocked. */
  hidden?: boolean
}

/** Evaluated once, against the global metrics. */
export interface GlobalAchievementRule extends AchievementRuleBase {
  scope: 'global'
  metric: GlobalMetric
}

/** Evaluated for every text, including texts created later. */
export interface TextAchievementRule extends AchievementRuleBase {
  scope: 'text'
  metric: TextMetric
}

/** One achievement template (spec §9.8); `scope` decides which metrics `metric` names. */
export type AchievementRule = GlobalAchievementRule | TextAchievementRule

export interface AchievementUnlock {
  key: string
  ruleId: string
  /** Set for text-scope rules only. */
  textId?: string
  tier: Tier
}

const RULE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'scope',
  'metric',
  'threshold',
  'tier',
  'category',
  'hidden',
])
const CATEGORIES: ReadonlySet<string> = new Set(ACHIEVEMENT_CATEGORIES)

const isTier = (value: unknown): value is Tier =>
  typeof value === 'string' && Object.hasOwn(TIER_XP, value)

/** Shape check for one rule; unknown keys are rejected so typos in `rules.json` fail loudly. */
export function isAchievementRule(value: unknown): value is AchievementRule {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const rule = value as Record<string, unknown>
  if (Object.keys(rule).some((key) => !RULE_KEYS.has(key))) return false
  const { id, scope, metric, threshold, tier, category, hidden } = rule
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    (scope === 'global' ? isGlobalMetric(metric) : scope === 'text' && isTextMetric(metric)) &&
    typeof threshold === 'number' &&
    Number.isFinite(threshold) &&
    threshold > 0 &&
    isTier(tier) &&
    typeof category === 'string' &&
    CATEGORIES.has(category) &&
    (hidden === undefined || typeof hidden === 'boolean')
  )
}

/** Validates a rule list (e.g. `rules.json`); throws on the first invalid or duplicate rule. */
export function parseAchievementRules(value: unknown): AchievementRule[] {
  if (!Array.isArray(value)) throw new TypeError('Achievement rules must be an array')
  const ids = new Set<string>()
  return value.map((rule: unknown, index) => {
    if (!isAchievementRule(rule)) {
      throw new TypeError(`Invalid achievement rule at index ${index}: ${JSON.stringify(rule)}`)
    }
    if (ids.has(rule.id)) throw new TypeError(`Duplicate achievement rule id: ${rule.id}`)
    ids.add(rule.id)
    return rule
  })
}

/** Every achievement of spec §9.5–9.6, in gallery order. */
export const ACHIEVEMENT_RULES: readonly AchievementRule[] = parseAchievementRules(rulesJson)

/** Idempotency key of an unlock: `ruleId` for global rules, `ruleId:textId` for text rules. */
export function achievementKey(ruleId: string, textId?: string): string {
  return textId === undefined ? ruleId : `${ruleId}:${textId}`
}

/**
 * Achievements to unlock now: rules whose metric reached the threshold and whose key is not
 * in `unlocked`. Text rules are checked for every text. Order: rules, then texts, as given.
 */
export function evaluateAchievements(input: {
  rules: readonly AchievementRule[]
  global: Record<GlobalMetric, number>
  texts: ReadonlyArray<{ textId: string; metrics: Record<TextMetric, number> }>
  unlocked: ReadonlySet<string>
}): AchievementUnlock[] {
  const { rules, global, texts, unlocked } = input
  const unlocks: AchievementUnlock[] = []
  for (const rule of rules) {
    if (rule.scope === 'global') {
      const key = achievementKey(rule.id)
      if (!unlocked.has(key) && global[rule.metric] >= rule.threshold) {
        unlocks.push({ key, ruleId: rule.id, tier: rule.tier })
      }
      continue
    }
    for (const { textId, metrics } of texts) {
      const key = achievementKey(rule.id, textId)
      if (!unlocked.has(key) && metrics[rule.metric] >= rule.threshold) {
        unlocks.push({ key, ruleId: rule.id, textId, tier: rule.tier })
      }
    }
  }
  return unlocks
}

export interface RuleProgress {
  /** The metric value clamped to 0…threshold (NaN counts as 0). */
  current: number
  threshold: number
  /** `current / threshold`, always within 0…1. */
  ratio: number
}

export function ruleProgress(rule: AchievementRule, value: number): RuleProgress {
  const current = Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), rule.threshold)
  return { current, threshold: rule.threshold, ratio: current / rule.threshold }
}

/** The lowest text-repetition milestone above the current count, e.g. 88 → 100 (12 left). */
export function nextTextMilestone(
  metrics: Record<TextMetric, number>,
  rules: readonly AchievementRule[],
): { rule: TextAchievementRule; remaining: number } | null {
  const repetitions = metrics.textRepetitions
  let next: TextAchievementRule | undefined
  for (const rule of rules) {
    if (rule.scope !== 'text' || rule.metric !== 'textRepetitions') continue
    if (rule.threshold > repetitions && (!next || rule.threshold < next.threshold)) next = rule
  }
  return next ? { rule: next, remaining: next.threshold - repetitions } : null
}
