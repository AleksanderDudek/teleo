import type { TFunction } from 'i18next'
import { APP_URL } from '@/components/support/links'

/** One day of practice, as shared. */
export interface DayShare {
  dayKey: string
  minutes: number
  sentences: number
  streak: number
  points: number
  /** Share of the whole Bible read aloud (0…1), once the Bible challenge has started. */
  bibleShare?: number
}

/** One finished session, as shared from its summary. */
export interface SessionShare {
  title: string
  accepted: number
  total: number
  /** Share of the sentences said on the first try (0…1). */
  firstTryRate: number
  xp: number
  streak: number
  /** Share of the whole Bible read aloud, after a Bible reading. */
  bibleShare?: number
}

const TEMPLATES = ['share.t1', 'share.t2', 'share.t3'] as const

/** Whole minutes read, rounded; a day with any reading shows at least 1. */
export function sharedMinutes(readingMs: number): number {
  return readingMs > 0 ? Math.max(1, Math.round(readingMs / 60_000)) : 0
}

/** "0.02%", "1.3%", "46%": enough decimals that the first readings already show. */
export function formatShare(share: number, lang: string): string {
  const percent = share * 100
  const digits = percent > 0 && percent < 1 ? 2 : percent < 10 ? 1 : 0
  return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: digits }).format(share)
}

/**
 * The post: first person, in the words people use about their own day, one call to action, the address
 * on its own last line (services build their link preview from the last URL of a post).
 */
export function shareText(day: DayShare, t: TFunction, lang: string, seed = 0): string {
  const template = TEMPLATES[Math.abs(Math.trunc(seed)) % TEMPLATES.length]!
  const body = t(template, { count: day.sentences, minutes: day.minutes, points: day.points, streak: day.streak })
  const bible = day.bibleShare ? ` ${t('share.bible', { percent: formatShare(day.bibleShare, lang) })}` : ''
  return [`${body}${bible}`, '', t('share.cta'), APP_URL].join('\n')
}

/** The post after a session: what was said, how cleanly, the streak; the same closing lines as the day. */
export function sessionShareText(session: SessionShare, t: TFunction, lang: string): string {
  const body = t('share.session', {
    count: session.accepted,
    title: session.title,
    firstTry: Math.round(session.firstTryRate * 100),
    streak: session.streak,
  })
  const bible = session.bibleShare ? ` ${t('share.bible', { percent: formatShare(session.bibleShare, lang) })}` : ''
  return [`${body}${bible}`, '', t('share.cta'), APP_URL].join('\n')
}

/** Direct "share" addresses for browsers without a system share sheet. */
export function shareLinks(text: string, t: TFunction): Array<{ name: string; url: string }> {
  const enc = encodeURIComponent
  return [
    { name: t('share.x'), url: `https://twitter.com/intent/tweet?text=${enc(text)}` },
    { name: t('share.facebook'), url: `https://www.facebook.com/sharer/sharer.php?u=${enc(APP_URL)}` },
    { name: t('share.whatsapp'), url: `https://wa.me/?text=${enc(text)}` },
  ]
}
