import { db } from '@/db/schema'
import type { FriendRow } from '@/db/types'
import { computeStreak, dayMarksFrom } from '@/domain/gamification'
import { encodeFriendCard, type FriendCard } from '@/domain/leaderboard/friends'
import { periodKey, pointsByPeriod, type Period } from '@/domain/leaderboard/periods'
import { dayKeyFor } from '@/domain/time/dayKey'
import { readSettings, updateMeta } from './settings'

/** Random letters and digits (friend-card ids must match `[a-z0-9]{6,32}`). */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

/** This install's card id, created on first use. */
async function shareId(): Promise<string> {
  const { meta } = await readSettings()
  if (meta.shareId) return meta.shareId
  const id = randomId()
  await updateMeta({ shareId: id })
  return id
}

/**
 * Your card for friends: name, figure, streak and the points of the current day, week and month.
 * `fallbackName` (the character's name) is used when no display name was chosen.
 */
export async function myFriendCard(fallbackName: string, now = Date.now()): Promise<FriendCard> {
  const { app } = await readSettings()
  const today = dayKeyFor(now, app.dayStartHour)
  const daily = await db.dailyStats.toArray()
  const points = (period: Period) => {
    const k = periodKey(period, today)
    return { k, p: Math.round(pointsByPeriod(daily, period).get(k) ?? 0) }
  }
  return {
    v: 1,
    id: await shareId(),
    name: (app.displayName.trim() || fallbackName).slice(0, 40),
    character: app.character,
    at: now,
    streak: computeStreak(dayMarksFrom(daily), today).current,
    day: points('day'),
    week: points('week'),
    month: points('month'),
  }
}

export function friendLinkCode(card: FriendCard): string {
  return encodeFriendCard(card)
}

/** The link that opens a card in Teleo (this build's own address, so it works in any deployment). */
export function friendLink(card: FriendCard, origin = window.location.origin): string {
  return new URL(`${import.meta.env.BASE_URL}#/friend?c=${friendLinkCode(card)}`, origin).href
}

export type SaveFriendResult = 'added' | 'updated' | 'older' | 'self'

/** Keeps the newest card of each friend; your own card is never added. */
export async function saveFriend(card: FriendCard, now = Date.now()): Promise<SaveFriendResult> {
  if (card.id === (await readSettings()).meta.shareId) return 'self'
  return db.transaction('rw', db.friends, async () => {
    const existing = await db.friends.get(card.id)
    if (existing && existing.at >= card.at) return 'older'
    const row: FriendRow = { ...card, receivedAt: now }
    await db.friends.put(row)
    return existing ? 'updated' : 'added'
  })
}

export async function removeFriend(id: string): Promise<void> {
  await db.friends.delete(id)
}
