import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { APP_URL } from '@/components/support/links'
import { formatShare, sessionShareText, sharedMinutes, shareLinks, shareText, type DayShare, type SessionShare } from './shareText'

const t = ((key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key)) as unknown as TFunction
const day: DayShare = { dayKey: '2026-09-27', minutes: 12, sentences: 86, streak: 5, points: 1240 }

describe('shareText', () => {
  it('writes the day, one call to action and the address on its own last line', () => {
    const lines = shareText(day, t, 'en', 0).split('\n')
    expect(lines[0]).toBe('share.t1{"count":86,"minutes":12,"points":1240,"streak":5}')
    expect(lines.slice(1)).toEqual(['', 'share.cta', APP_URL])
  })

  it('varies the wording with the seed', () => {
    expect(shareText(day, t, 'en', 1)).toContain('share.t2')
    expect(shareText(day, t, 'en', 5)).toContain('share.t3')
  })

  it('adds the Bible progress once the challenge has started', () => {
    expect(shareText({ ...day, bibleShare: 0.0123 }, t, 'en')).toContain('share.bible{"percent":"1.2%"}')
    expect(shareText({ ...day, bibleShare: 0 }, t, 'en')).not.toContain('share.bible')
  })
})

describe('sessionShareText', () => {
  const session: SessionShare = { title: 'Ojcze nasz', accepted: 4, total: 4, firstTryRate: 0.75, xp: 60, streak: 3 }

  it('writes the session, one call to action and the address on its own last line', () => {
    const lines = sessionShareText(session, t, 'pl').split('\n')
    expect(lines[0]).toBe('share.session{"count":4,"title":"Ojcze nasz","firstTry":75,"streak":3}')
    expect(lines.slice(1)).toEqual(['', 'share.cta', APP_URL])
  })

  it('rounds the first-try rate and adds the Bible progress of a Bible reading', () => {
    const text = sessionShareText({ ...session, firstTryRate: 2 / 3, bibleShare: 0.0123 }, t, 'en')
    expect(text).toContain('"firstTry":67')
    expect(text).toContain('share.bible{"percent":"1.2%"}')
  })
})

describe('sharedMinutes', () => {
  it('rounds to whole minutes and never shows 0 for a day with reading', () => {
    expect(sharedMinutes(0)).toBe(0)
    expect(sharedMinutes(20_000)).toBe(1)
    expect(sharedMinutes(90_000)).toBe(2)
    expect(sharedMinutes(12 * 60_000 + 20_000)).toBe(12)
  })
})

describe('formatShare', () => {
  it('shows two decimals below 1 %, one below 10 % and whole percents above', () => {
    expect(formatShare(1 / 5079, 'en')).toBe('0.02%')
    expect(formatShare(0, 'en')).toBe('0%')
    expect(formatShare(0.0456, 'en')).toBe('4.6%')
    expect(formatShare(0.456, 'en')).toBe('46%')
    expect(formatShare(0.0456, 'pl')).toBe('4,6%')
  })
})

describe('shareLinks', () => {
  it('encodes the post for X and WhatsApp and the app address for Facebook', () => {
    const [x, facebook, whatsapp] = shareLinks('A & B\nC', t)
    expect(x!.url).toBe('https://twitter.com/intent/tweet?text=A%20%26%20B%0AC')
    expect(facebook!.url).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}`)
    expect(whatsapp!.url).toBe('https://wa.me/?text=A%20%26%20B%0AC')
  })
})
