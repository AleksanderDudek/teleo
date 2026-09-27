import { describe, expect, it } from 'vitest'
import { decodeFriendCard, encodeFriendCard, friendsBoard, type FriendCard } from './friends'

const card: FriendCard = {
  v: 1,
  id: 'f7c1a2b3',
  name: 'Michał Ż.',
  character: 'michal',
  at: 1_790_000_000_000,
  streak: 12,
  day: { k: '2026-09-27', p: 320 },
  week: { k: '2026-09-21', p: 1840 },
  month: { k: '2026-09', p: 6210 },
}

describe('friend cards', () => {
  it('round-trip through a URL-safe code, Polish letters included', () => {
    const code = encodeFriendCard(card)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeFriendCard(code)).toEqual(card)
  })

  it('reject anything that is not a well-formed card', () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    expect(decodeFriendCard('%%%')).toBeNull()
    expect(decodeFriendCard(encode({ ...card, v: 2 }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, name: '' }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, name: 'x'.repeat(41) }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, character: 'zeus' }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, day: { k: '2026-9-27', p: 5 } }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, week: { k: '2026-09-21', p: -1 } }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, month: { k: '2026-09', p: 1.5 } }))).toBeNull()
    expect(decodeFriendCard(encode({ ...card, extra: true }))).toBeNull()
    expect(decodeFriendCard('A'.repeat(3000))).toBeNull()
  })
})

describe('friendsBoard', () => {
  const me = { name: 'Anna', character: 'anna' as const, points: 900 }
  it('ranks you and your friends by the current period, counting stale friends as 0', () => {
    const stale: FriendCard = { ...card, id: 'old', name: 'Jan', character: 'jan', week: { k: '2026-09-14', p: 5000 } }
    const rows = friendsBoard(me, [card, stale], 'week', '2026-09-21')
    expect(rows.map((r) => [r.name, r.points, r.me, r.stale])).toEqual([
      ['Michał Ż.', 1840, false, false],
      ['Anna', 900, true, false],
      ['Jan', 0, false, true],
    ])
  })
})
