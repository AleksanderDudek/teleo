import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import { decodeFriendCard, type FriendCard } from '@/domain/leaderboard/friends'
import { resetDb } from '@/test/db'
import { friendLinkCode, myFriendCard, removeFriend, saveFriend } from './leaderboard'
import { emptyDailyStats } from './progress'
import { readSettings, updateAppSettings } from './settings'

const at = (day: number, hour = 12) => new Date(2026, 8, day, hour).getTime()

beforeEach(async () => {
  await resetDb()
  await updateAppSettings({ dayStartHour: 3, character: 'grace', displayName: '' })
})

async function day(dayKey: string, xp: number) {
  await db.dailyStats.put({ ...emptyDailyStats(dayKey), segmentsAccepted: xp > 0 ? 1 : 0, xp })
}

describe('myFriendCard', () => {
  it('carries the name, figure, streak and current day/week/month points', async () => {
    await day('2026-09-21', 100) // Monday
    await day('2026-09-26', 40)
    await day('2026-09-27', 25) // Sunday = today
    await day('2026-08-30', 999)
    const card = await myFriendCard('Grace', at(27))
    expect(card).toMatchObject({
      v: 1,
      name: 'Grace',
      character: 'grace',
      at: at(27),
      streak: 2,
      day: { k: '2026-09-27', p: 25 },
      week: { k: '2026-09-21', p: 165 },
      month: { k: '2026-09', p: 165 },
    })
  })

  it('keeps one stable id per install and prefers the chosen display name', async () => {
    await updateAppSettings({ displayName: '  Grace K.  ' })
    const first = await myFriendCard('Grace', at(27))
    const second = await myFriendCard('Grace', at(27, 15))
    expect(first.id).toMatch(/^[a-z0-9]{6,32}$/i)
    expect(second.id).toBe(first.id)
    expect(second.name).toBe('Grace K.')
    expect((await readSettings()).meta.shareId).toBe(first.id)
  })

  it('round-trips through the link code', async () => {
    const card = await myFriendCard('Grace', at(27))
    expect(decodeFriendCard(friendLinkCode(card))).toEqual(card)
  })
})

describe('saveFriend', () => {
  const card: FriendCard = {
    v: 1,
    id: 'abcdef12',
    name: 'Piotr',
    character: 'piotr',
    at: 1000,
    streak: 1,
    day: { k: '2026-09-27', p: 10 },
    week: { k: '2026-09-21', p: 20 },
    month: { k: '2026-09', p: 30 },
  }

  it('adds a new friend, updates with a newer card and ignores an older one', async () => {
    expect(await saveFriend(card, 5000)).toBe('added')
    expect(await saveFriend({ ...card, at: 2000, day: { k: '2026-09-27', p: 99 } }, 6000)).toBe('updated')
    expect(await saveFriend({ ...card, at: 1500 }, 7000)).toBe('older')
    expect(await db.friends.get(card.id)).toMatchObject({ at: 2000, day: { p: 99 }, receivedAt: 6000 })
  })

  it('does not add yourself', async () => {
    const mine = await myFriendCard('Grace', at(27))
    expect(await saveFriend(mine, 1)).toBe('self')
    expect(await db.friends.count()).toBe(0)
  })

  it('removes a friend', async () => {
    await saveFriend(card, 1)
    await removeFriend(card.id)
    expect(await db.friends.count()).toBe(0)
  })
})
