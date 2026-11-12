import { useMemo, useSyncExternalStore } from 'react'
import { detectInstallPlatform, isMobileDevice, type InstallPlatform } from '@/domain/install/platform'

/** Chromium's install offer (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installedNow = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

const isStandalone = () => {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** What may change during a visit, as a stable string for `useSyncExternalStore`; the user agent never does. */
const snapshot = () => `${isStandalone()}|${installedNow}|${deferred !== null}`

/**
 * Before the first render: the browser makes its install offer once, early in the visit. It is kept (and
 * the automatic mini-infobar suppressed) so Teleo can offer installation at a better moment (DECISIONS #140).
 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    notify()
  })
}

/** Shows the browser's own install dialog; true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null // an offer can be shown only once
  await event.prompt()
  const { outcome } = await event.userChoice
  notify()
  return outcome === 'accepted'
}

/** How this device installs Teleo, kept current through the visit; `mobile` = a phone or tablet. */
export function useInstallPlatform(): { platform: InstallPlatform; mobile: boolean } {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot,
    () => 'server',
  )
  return useMemo(() => {
    const env = { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 }
    const [standalone, now, prompt] = state.split('|')
    return {
      platform: detectInstallPlatform({ ...env, standalone: standalone === 'true', installedNow: now === 'true', hasPrompt: prompt === 'true' }),
      mobile: isMobileDevice(env),
    }
  }, [state])
}

/** The address a page opened elsewhere should start from: the app's start page. */
export const startPageUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href
