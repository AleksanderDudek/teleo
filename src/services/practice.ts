import { db } from '@/db/schema'
import type { Attempt, DailyStats, GameState, SessionRun, TextStats } from '@/db/types'
import {
  computeStreak,
  dayMarksFrom,
  freezeAward,
  isComeback,
  levelInfo,
  nextTextDayStreak,
  reconcileFreezes,
  segmentXp,
  textCompletionXp,
  XP_RULES,
} from '@/domain/gamification'
import { blockEntries, isBlockComplete } from '@/domain/session'
import { dayKeyFor } from '@/domain/time/dayKey'
import type { DayKey, EngineId } from '@/domain/types'
import { newId } from '@/lib/id'
import { useSettingsStore } from '@/stores/settings'
import { emptyDailyStats, PROGRESS_TABLES, unlockAchievements, type UnlockedAchievement } from './progress'
import { readSettings } from './settings'

/** What the practice service needs from a matcher result (structural: `MatchResult` fits). */
export interface Evaluation {
  accepted: boolean
  coverage: number
  extra: number
  wrong: number
  transcript: string
}

export interface AttemptInput {
  runId: string
  /** Must be the run's cursor: segments are spoken in order. */
  entryIndex: number
  evaluation: Evaluation
  engine: EngineId
  durationMs: number
  now?: number
}

export interface ProgressOutcome {
  xpGained: number
  unlocked: UnlockedAchievement[]
  levelUp?: { from: number; to: number }
  streak: number
  goalReached: boolean
  goalProgress: { done: number; goal: number }
  freezeEarned: boolean
}

export interface AttemptOutcome extends ProgressOutcome {
  accepted: boolean
  firstTry: boolean
  segmentXp: number
  run: SessionRun
  textCompleted?: { textId: string; bonusXp: number; perfect: boolean }
  /** Failed attempts on this entry so far (drives the "skip after 3" rule). */
  failedAttempts: number
}

export interface FinishOutcome extends ProgressOutcome {
  run: SessionRun
  clean: boolean
}

export type PracticeErrorCode = 'runNotFound' | 'notRunning' | 'outOfOrder' | 'segmentMissing'

export class PracticeError extends Error {
  readonly code: PracticeErrorCode
  constructor(code: PracticeErrorCode) {
    super(`Practice error: ${code}`)
    this.name = 'PracticeError'
    this.code = code
  }
}

const TABLES = [db.sessionRuns, db.attempts, ...PROGRESS_TABLES]

function emptyTextStats(textId: string): TextStats {
  return {
    textId,
    repetitions: 0,
    segmentsAccepted: 0,
    currentDayStreak: 0,
    bestDayStreak: 0,
    perfectRuns: 0,
    consecutiveFirstTry: 0,
    bestConsecutiveFirstTry: 0,
    memoryRuns: 0,
  }
}

/** Morning = before 08:00 (after the day start); evening = 21:00 until the day start (DECISIONS #19). */
function timeOfDay(timestamp: number, dayStartHour: number): { morning: boolean; evening: boolean } {
  const hour = new Date(timestamp).getHours()
  return { morning: hour >= dayStartHour && hour < 8, evening: hour >= 21 || hour < dayStartHour }
}

async function currentStreak(today: DayKey): Promise<number> {
  return computeStreak(dayMarksFrom(await db.dailyStats.toArray()), today).current
}

async function loadRunning(runId: string): Promise<SessionRun> {
  const run = await db.sessionRuns.get(runId)
  if (!run) throw new PracticeError('runNotFound')
  if (run.status === 'completed') throw new PracticeError('notRunning')
  return run
}

function nextPending(run: SessionRun, from: number): number {
  let i = from
  while (i < run.entries.length && run.entries[i]?.status !== 'pending') i++
  return i
}

function publishGame(game: GameState) {
  useSettingsStore.setState({ game })
}

/**
 * Records one spoken attempt and applies every consequence in ONE transaction:
 * attempt row, run progress, daily/text aggregates, XP ledger (segment, text
 * completion, daily goal), streak freezes, comeback and achievements.
 */
export async function recordAttempt(input: AttemptInput): Promise<AttemptOutcome> {
  const now = input.now ?? Date.now()
  const outcome = await db.transaction('rw', TABLES, async (): Promise<AttemptOutcome> => {
    const { app, game } = await readSettings()
    const run = await loadRunning(input.runId)
    if (input.entryIndex !== run.cursor) throw new PracticeError('outOfOrder')
    const planEntry = run.plan[input.entryIndex]
    const entry = run.entries[input.entryIndex]
    if (!planEntry || !entry || entry.status !== 'pending') throw new PracticeError('outOfOrder')
    const segment = await db.segments.get(planEntry.segmentId)
    const text = await db.texts.get(planEntry.textId)
    if (!segment || !text) throw new PracticeError('segmentMissing')

    const dayKey = dayKeyFor(now, app.dayStartHour)
    const levelBefore = levelInfo(game.totalXp).level
    const accepted = input.evaluation.accepted
    entry.attempts += 1
    const firstTry = accepted && entry.attempts === 1

    const attempt: Attempt = {
      id: newId(),
      segmentId: segment.id,
      textId: text.id,
      sessionRunId: run.id,
      dayKey,
      timestamp: now,
      transcript: app.saveTranscripts ? input.evaluation.transcript : undefined,
      coverage: input.evaluation.coverage,
      extra: input.evaluation.extra,
      wrong: input.evaluation.wrong,
      accepted,
      firstTry,
      strictness: app.strictness,
      engine: input.engine,
      durationMs: input.durationMs,
    }
    await db.attempts.add(attempt)

    const daily: DailyStats = (await db.dailyStats.get(dayKey)) ?? emptyDailyStats(dayKey)
    const textStats = (await db.textStats.get(text.id)) ?? emptyTextStats(text.id)
    daily.attempts += 1
    run.lastActivityAt = now
    run.status = 'in_progress'

    const result: AttemptOutcome = {
      accepted,
      firstTry,
      segmentXp: 0,
      run,
      failedAttempts: entry.attempts - (accepted ? 1 : 0),
      xpGained: 0,
      unlocked: [],
      streak: 0,
      goalReached: false,
      goalProgress: { done: daily.segmentsAccepted, goal: app.dailyGoal },
      freezeEarned: false,
    }

    if (!accepted) {
      textStats.consecutiveFirstTry = 0
      await db.dailyStats.put(daily)
      await db.textStats.put(textStats)
      await db.sessionRuns.put(run)
      result.streak = await currentStreak(dayKey)
      return result
    }

    // --- accepted -----------------------------------------------------------
    const firstActivityToday = daily.segmentsAccepted === 0
    if (firstActivityToday) {
      const previous = (await db.dailyStats.toArray())
        .filter((d) => d.segmentsAccepted > 0 && d.dayKey < dayKey)
        .map((d) => d.dayKey)
        .sort()
        .at(-1)
      if (isComeback(previous, dayKey)) game.comebacks += 1
    }
    const { morning, evening } = timeOfDay(now, app.dayStartHour)
    daily.segmentsAccepted += 1
    daily.firstTryAccepted += firstTry ? 1 : 0
    daily.langs = daily.langs.includes(text.lang) ? daily.langs : [...daily.langs, text.lang]
    daily.firstActivityAt ??= now
    daily.lastActivityAt = now
    daily.morning ||= morning
    daily.evening ||= evening
    await db.dailyStats.put(daily)

    const streak = await currentStreak(dayKey)
    if (firstActivityToday) {
      const award = freezeAward(streak, game.lastFreezeAwardStreak, game.freezesAvailable)
      game.lastFreezeAwardStreak = award.lastAwardStreak
      game.freezesAvailable += award.award
      result.freezeEarned = award.award > 0
    }

    const xp = segmentXp(segment.wordCount, firstTry, streak).total
    await db.xpLedger.add({ timestamp: now, dayKey, reason: 'segment', amount: xp, refId: attempt.id })
    let gained = xp
    entry.status = 'accepted'
    entry.firstTry = firstTry
    entry.xp = xp

    textStats.segmentsAccepted += 1
    textStats.lastPracticedAt = now
    textStats.consecutiveFirstTry = firstTry ? textStats.consecutiveFirstTry + 1 : 0
    textStats.bestConsecutiveFirstTry = Math.max(textStats.bestConsecutiveFirstTry, textStats.consecutiveFirstTry)

    if (planEntry.fullText && isBlockComplete(run.plan, run.entries, planEntry.block)) {
      const indices = blockEntries(run.plan, planEntry.block)
      const bonusXp = textCompletionXp(indices.reduce((sum, i) => sum + (run.entries[i]?.xp ?? 0), 0))
      const perfect = indices.length > 1 && indices.every((i) => run.entries[i]?.firstTry)
      textStats.repetitions += 1
      if (perfect) textStats.perfectRuns += 1
      const dayStreak = nextTextDayStreak(
        { current: textStats.currentDayStreak, best: textStats.bestDayStreak, lastDayKey: textStats.lastDayKey },
        dayKey,
      )
      textStats.currentDayStreak = dayStreak.current
      textStats.bestDayStreak = dayStreak.best
      textStats.lastDayKey = dayStreak.lastDayKey
      daily.textsCompleted += 1
      if (bonusXp > 0) await db.xpLedger.add({ timestamp: now, dayKey, reason: 'textComplete', amount: bonusXp, refId: `${run.id}:${planEntry.block}` })
      gained += bonusXp
      result.textCompleted = { textId: text.id, bonusXp, perfect }
    }

    if (!daily.goalReached && daily.segmentsAccepted >= app.dailyGoal) {
      daily.goalReached = true
      await db.xpLedger.add({ timestamp: now, dayKey, reason: 'dailyGoal', amount: XP_RULES.dailyGoal, refId: dayKey })
      gained += XP_RULES.dailyGoal
      result.goalReached = true
    }

    daily.xp += gained
    game.totalXp += gained
    run.xpEarned += gained
    run.cursor = nextPending(run, input.entryIndex + 1)
    await db.dailyStats.put(daily)
    await db.textStats.put(textStats)

    const unlocked = await unlockAchievements({ game, dayKey, now, textIds: [text.id] })
    const achievementXp = unlocked.reduce((sum, u) => sum + u.xp, 0)
    run.xpEarned += achievementXp
    await db.sessionRuns.put(run)

    const levelAfter = levelInfo(game.totalXp).level
    Object.assign(result, {
      segmentXp: xp,
      xpGained: gained + achievementXp,
      unlocked,
      streak,
      goalProgress: { done: daily.segmentsAccepted, goal: app.dailyGoal },
      levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : undefined,
    })
    return result
  })
  publishGame((await readSettings()).game)
  return outcome
}

/** Skips the current entry after failed attempts (spec §8.3/5): no XP, breaks the text repetition. */
export async function skipEntry(runId: string, entryIndex: number, now = Date.now()): Promise<SessionRun> {
  return db.transaction('rw', [db.sessionRuns, db.textStats], async () => {
    const run = await loadRunning(runId)
    const entry = run.entries[entryIndex]
    const planEntry = run.plan[entryIndex]
    if (entryIndex !== run.cursor || !entry || !planEntry || entry.status !== 'pending') throw new PracticeError('outOfOrder')
    entry.status = 'skipped'
    run.cursor = nextPending(run, entryIndex + 1)
    run.lastActivityAt = now
    await db.sessionRuns.put(run)
    const stats = await db.textStats.get(planEntry.textId)
    if (stats) await db.textStats.put({ ...stats, consecutiveFirstTry: 0 })
    return run
  })
}

/** Leaves a session midway; it can be resumed the same day (spec §8.3/6). */
export async function pauseRun(runId: string, now = Date.now()): Promise<void> {
  await db.sessionRuns.where('id').equals(runId).filter((r) => r.status === 'in_progress').modify({ status: 'partial', lastActivityAt: now })
}

/**
 * Ends a session that reached its last entry. Only a run with ≥ 1 accepted and
 * no skipped entries is "completed" for XP and statistics (DECISIONS #21).
 */
export async function finishRun(runId: string, now = Date.now()): Promise<FinishOutcome> {
  const outcome = await db.transaction('rw', TABLES, async (): Promise<FinishOutcome> => {
    const { app, game } = await readSettings()
    const run = await db.sessionRuns.get(runId)
    if (!run) throw new PracticeError('runNotFound')
    const dayKey = dayKeyFor(now, app.dayStartHour)
    const daily = (await db.dailyStats.get(dayKey)) ?? emptyDailyStats(dayKey)
    const levelBefore = levelInfo(game.totalXp).level
    const alreadyCompleted = run.status === 'completed'
    const accepted = run.entries.filter((e) => e.status === 'accepted').length
    const skipped = run.entries.filter((e) => e.status === 'skipped').length
    const clean = accepted > 0 && skipped === 0 && run.entries.every((e) => e.status !== 'pending')

    run.status = 'completed'
    run.endedAt = now
    run.lastActivityAt = now
    let gained = 0
    let unlocked: UnlockedAchievement[] = []
    if (clean && !alreadyCompleted) {
      await db.xpLedger.add({ timestamp: now, dayKey, reason: 'sessionComplete', amount: XP_RULES.sessionComplete, refId: run.id })
      gained = XP_RULES.sessionComplete
      daily.sessionsCompleted += 1
      daily.xp += gained
      game.totalXp += gained
      if (run.plan.length >= 10 && run.entries.every((e) => e.firstTry)) game.perfectSessions += 1
      if (run.plan.length >= 150) game.fullSessions += 1
      await db.dailyStats.put(daily)
      unlocked = await unlockAchievements({ game, dayKey, now, textIds: [] })
    }
    const achievementXp = unlocked.reduce((sum, u) => sum + u.xp, 0)
    run.xpEarned += gained + achievementXp
    await db.sessionRuns.put(run)
    await db.settings.put({ key: 'game', value: game })
    const levelAfter = levelInfo(game.totalXp).level
    return {
      run,
      clean,
      xpGained: gained + achievementXp,
      unlocked,
      levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : undefined,
      streak: await currentStreak(dayKey),
      goalReached: false,
      goalProgress: { done: daily.segmentsAccepted, goal: app.dailyGoal },
      freezeEarned: false,
    }
  })
  publishGame((await readSettings()).game)
  return outcome
}

/**
 * App start: bridge missed days with streak freezes when they cover the whole gap
 * (DECISIONS #16) and remember them for the "your streak is safe" notice.
 */
export async function reconcileStreakFreezes(now = Date.now()): Promise<DayKey[]> {
  return db.transaction('rw', [db.dailyStats, db.settings], async () => {
    const { app, game } = await readSettings()
    const today = dayKeyFor(now, app.dayStartHour)
    const marks = dayMarksFrom(await db.dailyStats.toArray())
    const { frozenDays, freezesLeft } = reconcileFreezes(marks, today, game.freezesAvailable)
    if (frozenDays.length === 0) return []
    for (const dayKey of frozenDays) {
      const existing = (await db.dailyStats.get(dayKey)) ?? emptyDailyStats(dayKey)
      await db.dailyStats.put({ ...existing, frozen: true })
    }
    await db.settings.put({
      key: 'game',
      value: { ...game, freezesAvailable: freezesLeft, pendingFreezeNotice: [...game.pendingFreezeNotice, ...frozenDays] },
    })
    return frozenDays
  })
}
