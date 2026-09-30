import { useSyncExternalStore } from 'react'

/** Chromium's install offer (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * installed — running as the installed app · prompt — the browser lets us offer installation ·
 * ios — Safari on iPhone/iPad (installed from the Share menu by hand) · unavailable — nothing to offer.
 */
export type InstallState = 'installed' | 'prompt' | 'ios' | 'unavailable'

let deferred: BeforeInstallPromptEvent | null = null
let installedNow = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** iPhone, iPod, or an iPad (which reports itself as a Mac with a touch screen). */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)
}

export function resolveInstallState(env: { standalone: boolean; installedNow: boolean; hasPrompt: boolean; ios: boolean }): InstallState {
  if (env.standalone || env.installedNow) return 'installed'
  if (env.hasPrompt) return 'prompt'
  if (env.ios) return 'ios'
  return 'unavailable'
}

function currentState(): InstallState {
  const nav = navigator as Navigator & { standalone?: boolean }
  return resolveInstallState({
    standalone: nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true,
    installedNow,
    hasPrompt: deferred !== null,
    ios: isIosDevice(nav.userAgent, nav.maxTouchPoints ?? 0),
  })
}

/**
 * Before the first render: the browser makes its install offer once, early in the visit. It is kept (and
 * the automatic mini-infobar suppressed) so Settings can offer installation when the user looks for it.
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

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    currentState,
    () => 'unavailable',
  )
}
