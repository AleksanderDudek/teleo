import { CHARACTER_IDS, type CharacterId } from '@/domain/types'
import type { Period } from './periods'

export interface PeriodPoints {
  /** Period key (`YYYY-MM-DD` for a day or a week's Monday, `YYYY-MM` for a month). */
  k: string
  /** Points. */
  p: number
}

/**
 * What a friend shares through a link: their name, figure and current points. No server exists, so a
 * friends' leaderboard is built from these cards — each device keeps the latest card of each friend.
 */
export interface FriendCard {
  v: 1
  /** Random per-install id: a newer card from the same person replaces the older one. */
  id: string
  name: string
  character: CharacterId
  /** When the card was made (ms). */
  at: number
  streak: number
  day: PeriodPoints
  week: PeriodPoints
  month: PeriodPoints
}

const MAX_CODE = 2000
const MAX_NAME = 40
const MAX_POINTS = 100_000_000
const KEYS = ['v', 'id', 'name', 'character', 'at', 'streak', 'day', 'week', 'month'].sort().join()
const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

function isPoints(value: unknown, key: RegExp): value is PeriodPoints {
  return isObject(value) && Object.keys(value).sort().join() === 'k,p' && typeof value.k === 'string' && key.test(value.k) && isCount(value.p, MAX_POINTS)
}

function isFriendCard(value: unknown): value is FriendCard {
  if (!isObject(value) || Object.keys(value).sort().join() !== KEYS) return false
  const { v, id, name, character, at, streak, day, week, month } = value
  return (
    v === 1 &&
    typeof id === 'string' &&
    /^[a-z0-9]{6,32}$/i.test(id) &&
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= MAX_NAME &&
    typeof character === 'string' &&
    (CHARACTER_IDS as readonly string[]).includes(character) &&
    isCount(at, Number.MAX_SAFE_INTEGER) &&
    isCount(streak, 100_000) &&
    isPoints(day, DAY) &&
    isPoints(week, DAY) &&
    isPoints(month, MONTH)
  )
}

/** JSON → UTF-8 → base64url (no padding): safe inside a URL hash. */
export function encodeFriendCard(card: FriendCard): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(JSON.stringify(card))) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** The card inside a link code, or `null` for anything malformed (links travel through other apps). */
export function decodeFriendCard(code: string): FriendCard | null {
  if (code.length > MAX_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  try {
    const binary = atob(code.replaceAll('-', '+').replaceAll('_', '/'))
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
    const value: unknown = JSON.parse(json)
    return isFriendCard(value) ? value : null
  } catch {
    return null
  }
}

export interface BoardRow {
  id: string
  name: string
  character: CharacterId
  points: number
  me: boolean
  /** The friend's card is from an earlier period: their points here are unknown, shown as 0. */
  stale: boolean
}

/** You and your friends for the current period, most points first (you first on a tie). */
export function friendsBoard(
  me: { name: string; character: CharacterId; points: number },
  friends: readonly FriendCard[],
  period: Period,
  currentKey: string,
): BoardRow[] {
  const rows: BoardRow[] = [
    { id: 'me', name: me.name, character: me.character, points: me.points, me: true, stale: false },
    ...friends.map((friend) => {
      const current = friend[period].k === currentKey
      return { id: friend.id, name: friend.name, character: friend.character, points: current ? friend[period].p : 0, me: false, stale: !current }
    }),
  ]
  return rows.sort((a, b) => b.points - a.points || Number(b.me) - Number(a.me))
}
