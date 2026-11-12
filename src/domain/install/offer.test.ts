import { describe, expect, it } from 'vitest'
import { afterDismissal, INSTALL_OFFER_GAP_MS, INSTALL_OFFER_LIMIT, shouldOfferInstall } from './offer'
import type { InstallPlatform } from './platform'

const NOW = Date.UTC(2026, 10, 12, 12)
const safari: InstallPlatform = { kind: 'ios-safari', layout: 'menu' }
const instagram: InstallPlatform = { kind: 'in-app', app: 'instagram', os: 'ios' }
const base = { platform: safari, mobile: true, now: NOW, moment: 'summary' as const }

describe('install offer', () => {
  it('opens on the summary of a finished session on a phone that can install', () => {
    expect(shouldOfferInstall(base)).toBe(true)
    expect(shouldOfferInstall({ ...base, platform: { kind: 'native' } })).toBe(true)
    expect(shouldOfferInstall({ ...base, platform: { kind: 'android-menu' } })).toBe(true)
  })

  it('never opens by itself on a desktop, inside the app, or where nothing can be offered', () => {
    expect(shouldOfferInstall({ ...base, platform: { kind: 'native' }, mobile: false })).toBe(false)
    expect(shouldOfferInstall({ ...base, platform: { kind: 'installed' } })).toBe(false)
    expect(shouldOfferInstall({ ...base, platform: { kind: 'unavailable' } })).toBe(false)
  })

  it('asks in-app browsers on Today, before anything is done there, and nobody else', () => {
    expect(shouldOfferInstall({ ...base, platform: instagram, moment: 'today' })).toBe(true)
    expect(shouldOfferInstall({ ...base, platform: instagram })).toBe(false)
    expect(shouldOfferInstall({ ...base, moment: 'today' })).toBe(false)
  })

  it('comes back a week after "Not now", and stops after the third', () => {
    const once = afterDismissal(undefined, NOW)
    expect(once).toEqual({ dismissals: 1, lastDismissedAt: NOW })
    expect(shouldOfferInstall({ ...base, offer: once, now: NOW + INSTALL_OFFER_GAP_MS - 1 })).toBe(false)
    expect(shouldOfferInstall({ ...base, offer: once, now: NOW + INSTALL_OFFER_GAP_MS })).toBe(true)

    let offer = once
    for (let n = 1; n < INSTALL_OFFER_LIMIT; n++) offer = afterDismissal(offer, NOW)
    expect(offer.dismissals).toBe(INSTALL_OFFER_LIMIT)
    expect(shouldOfferInstall({ ...base, offer, now: NOW + 365 * INSTALL_OFFER_GAP_MS })).toBe(false)
  })
})
