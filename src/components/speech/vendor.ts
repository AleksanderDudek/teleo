export type SpeechVendor = 'Google' | 'Microsoft' | 'Apple' | 'Generic'

/** Who processes Web Speech audio in this browser (for the privacy notice, spec §5.2). */
export function speechVendor(userAgent: string = globalThis.navigator?.userAgent ?? ''): SpeechVendor {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'Apple' // every iOS browser uses WebKit's recognizer
  if (/Edg\//.test(userAgent)) return 'Microsoft'
  if (/Chrome|Chromium|CriOS|Android/.test(userAgent)) return 'Google'
  if (/Safari/.test(userAgent)) return 'Apple'
  return 'Generic'
}

/** Installed PWA on iOS, where Web Speech has historically been unreliable (spec §5.2). */
export function isIosStandalone(): boolean {
  const nav = globalThis.navigator as Navigator & { standalone?: boolean }
  const ios = /iPhone|iPad|iPod/.test(nav?.userAgent ?? '')
  const standalone = nav?.standalone === true || globalThis.matchMedia?.('(display-mode: standalone)').matches === true
  return ios && standalone
}
