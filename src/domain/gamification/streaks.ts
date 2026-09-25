import { addDays, diffDays, isoWeekday, rangeDays } from '@/domain/time/dayKey'
import type { DayKey } from '@/domain/types'

/** One calendar day of history: `active` = ≥ 1 accepted segment, `frozen` = bridged by a freeze. */
export interface DayMark {
  active: boolean
  frozen: boolean
}

export type DayMarks = ReadonlyMap<DayKey, DayMark>

/** Freezes in store at most (spec §9.7). */
export const MAX_FREEZES = 2
/** One freeze is earned every time the streak reaches a multiple of this many days. */
export const FREEZE_EVERY = 7
/** Active days an ISO week needs to count for the weekly rhythm (`weekly.5of7.x4`). */
export const RHYTHM_ACTIVE_DAYS = 5
/** Last active day at least this many days ago = at least 3 full idle days in between. */
const COMEBACK_DAYS = 4

export interface StreakInfo {
  /** Active days in the chain that ends today or yesterday (0 when there is none). */
  current: number
  /** Largest chain value in the history up to today, the current chain included. */
  best: number
  todayActive: boolean
  /** The streak ends unless the user is active today. */
  atRisk: boolean
}

/** A maximal run of consecutive covered (active or frozen) days. */
interface Chain {
  end: DayKey
  /** Active days in the chain; frozen days keep it alive but add nothing. */
  active: number
}

const isCovered = (mark: DayMark) => mark.active || mark.frozen

/** Chains of covered days up to and including `until`, oldest first. */
function chainsUntil(days: DayMarks, until: DayKey): Chain[] {
  const covered = [...days]
    .filter(([day, mark]) => day <= until && isCovered(mark))
    .sort(([a], [b]) => (a < b ? -1 : 1)) // map keys are unique
  const chains: Chain[] = []
  let chain: Chain | undefined
  for (const [day, mark] of covered) {
    if (chain && diffDays(day, chain.end) === 1) {
      chain.end = day
    } else {
      chain = { end: day, active: 0 }
      chains.push(chain)
    }
    if (mark.active) chain.active++
  }
  return chains
}

export function computeStreak(days: DayMarks, today: DayKey): StreakInfo {
  const chains = chainsUntil(days, today)
  const last = chains.at(-1)
  const current = last && diffDays(today, last.end) <= 1 ? last.active : 0
  const best = chains.reduce((max, chain) => Math.max(max, chain.active), 0)
  const todayActive = days.get(today)?.active ?? false
  return { current, best, todayActive, atRisk: current > 0 && !todayActive }
}

export interface FreezeReconciliation {
  /** Missed days to store as frozen, oldest first (empty when nothing was consumed). */
  frozenDays: DayKey[]
  freezesLeft: number
}

/**
 * Run when the app opens: bridges the missed days between the last covered day and today
 * with freezes — only when the freezes cover the whole gap and the chain before it has an
 * active day. Otherwise the streak simply ends and the freezes are kept. Idempotent once the
 * returned days are stored as frozen.
 */
export function reconcileFreezes(
  days: DayMarks,
  today: DayKey,
  freezesAvailable: number,
): FreezeReconciliation {
  const unchanged = { frozenDays: [], freezesLeft: freezesAvailable }
  const yesterday = addDays(today, -1)
  const chain = chainsUntil(days, yesterday).at(-1)
  if (!chain || chain.active === 0) return unchanged
  const gap = diffDays(yesterday, chain.end) // missed days strictly between chain and today
  if (gap === 0 || gap > freezesAvailable) return unchanged
  return {
    frozenDays: rangeDays(addDays(chain.end, 1), yesterday),
    freezesLeft: freezesAvailable - gap,
  }
}

export interface FreezeAward {
  award: number
  /**
   * Persist as `GameState.lastFreezeAwardStreak` after EVERY call, also when `award` is 0.
   */
  lastAwardStreak: number
}

/**
 * Call after every accepted attempt. Awards a freeze when the streak reaches a multiple of 7
 * (7, 14, 21 …) other than the stored milestone while fewer than 2 are stored.
 *
 * Callers must persist the returned `lastAwardStreak` after EVERY call — also when `award` is
 * 0. It changes on calls that award nothing (a capped milestone, a chain restart), and the
 * chain-restart reset below only works when those values are stored.
 * - The milestone is stored even when the store is full, so repeated calls with the same
 *   streak value award nothing.
 * - A streak only grows within a chain, so `newStreak < lastAwardStreak` means the chain
 *   restarted: the stored milestone counts as 0 (and 0 is returned unless `newStreak` is itself
 *   a milestone), so the new chain earns freezes at 7, 14 … again.
 */
export function freezeAward(
  newStreak: number,
  lastAwardStreak: number,
  available: number,
): FreezeAward {
  const last = newStreak < lastAwardStreak ? 0 : lastAwardStreak
  const milestone = newStreak > 0 && newStreak % FREEZE_EVERY === 0
  if (!milestone) return { award: 0, lastAwardStreak: last }
  const award = newStreak !== last && available < MAX_FREEZES ? 1 : 0
  return { award, lastAwardStreak: newStreak }
}

/** First activity after at least 3 full idle days (spec §9.6 `comeback`). */
export function isComeback(lastActiveDay: DayKey | undefined, today: DayKey): boolean {
  return lastActiveDay !== undefined && diffDays(today, lastActiveDay) >= COMEBACK_DAYS
}

/**
 * Longest run of consecutive ISO weeks (Monday–Sunday) with at least 5 active days each.
 * Weeks are keyed by their Monday, so 53-week years need no special handling.
 */
export function weeklyRhythmBest(days: DayMarks): number {
  const activeByMonday = new Map<DayKey, number>()
  for (const [day, mark] of days) {
    if (!mark.active) continue
    const monday = addDays(day, 1 - isoWeekday(day))
    activeByMonday.set(monday, (activeByMonday.get(monday) ?? 0) + 1)
  }
  const mondays = [...activeByMonday]
    .filter(([, active]) => active >= RHYTHM_ACTIVE_DAYS)
    .map(([monday]) => monday)
    .sort()
  let best = 0
  let run = 0
  let previous: DayKey | undefined
  for (const monday of mondays) {
    run = previous !== undefined && diffDays(monday, previous) === 7 ? run + 1 : 1
    best = Math.max(best, run)
    previous = monday
  }
  return best
}

export interface TextDayStreak {
  current: number
  best: number
  lastDayKey: DayKey
}

/**
 * Per-text "said N days in a row" (no freezes), updated when the text is said on `today`:
 * the day after `lastDayKey` → +1; the same day, or a day before `lastDayKey` (the day-start
 * hour or the time zone changed) → unchanged; otherwise → 1.
 */
export function nextTextDayStreak(
  prev: { current: number; best: number; lastDayKey?: DayKey },
  today: DayKey,
): TextDayStreak {
  const { current, best, lastDayKey } = prev
  const saidToday = (next: number): TextDayStreak => ({
    current: next,
    best: Math.max(best, next),
    lastDayKey: today,
  })
  if (lastDayKey === undefined) return saidToday(1)
  const days = diffDays(today, lastDayKey)
  if (days <= 0) return { current, best, lastDayKey }
  return saidToday(days === 1 ? current + 1 : 1)
}
