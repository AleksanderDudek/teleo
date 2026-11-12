import { isInstallable, type InstallPlatform } from './platform'

/** Kept in `meta` per install: how often the offer was turned down, and when last (DECISIONS #140). */
export interface InstallOffer {
  dismissals: number
  lastDismissedAt?: number
}

/** After this many "Not now"s the offer no longer opens by itself (Today and Settings still have it). */
export const INSTALL_OFFER_LIMIT = 3
export const INSTALL_OFFER_GAP_MS = 7 * 86_400_000

/** `summary` — after a finished session; `today` — the start screen, for in-app browsers only. */
export type InstallMoment = 'summary' | 'today'

/** Whether the install sheet opens by itself at this moment. */
export function shouldOfferInstall(input: {
  platform: InstallPlatform
  mobile: boolean
  offer?: InstallOffer
  now: number
  moment: InstallMoment
}): boolean {
  const { platform, mobile, offer, now, moment } = input
  if (!mobile || !isInstallable(platform)) return false
  // Nothing done in an app's built-in browser moves to Safari or Chrome: those hear it before any progress;
  // everyone else after their first finished session, once Teleo has shown what it is for.
  if ((platform.kind === 'in-app') !== (moment === 'today')) return false
  if ((offer?.dismissals ?? 0) >= INSTALL_OFFER_LIMIT) return false
  return offer?.lastDismissedAt === undefined || now - offer.lastDismissedAt >= INSTALL_OFFER_GAP_MS
}

export function afterDismissal(offer: InstallOffer | undefined, now: number): InstallOffer {
  return { dismissals: (offer?.dismissals ?? 0) + 1, lastDismissedAt: now }
}
