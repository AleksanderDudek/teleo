/**
 * How this device puts Teleo on its home screen (DECISIONS #140) — decided from the user agent and from what the
 * browser offered. Pure: `src/lib/install.ts` feeds it the live browser state.
 */

/** Apps whose built-in browser cannot install a web app; `other` = a built-in browser we cannot name. */
export type InAppBrowser = 'instagram' | 'facebook' | 'messenger' | 'tiktok' | 'snapchat' | 'linkedin' | 'line' | 'wechat' | 'other'

/** Safari 26+ keeps Share in the ⋯ menu next to the address bar; older Safari shows it in the toolbar. */
export type SafariLayout = 'menu' | 'toolbar'

export type InstallPlatform =
  | { kind: 'installed' }
  /** The browser fired `beforeinstallprompt`: one tap opens its own install dialog. */
  | { kind: 'native' }
  | { kind: 'ios-safari'; layout: SafariLayout }
  | { kind: 'ios-chrome' }
  /** Edge, Firefox and others on iPhone/iPad: Share → Add to Home Screen, wherever they keep Share. */
  | { kind: 'ios-other' }
  /** An Android browser without one-tap install (Firefox, or Chrome once it stopped offering): the ⋮ menu. */
  | { kind: 'android-menu' }
  | { kind: 'in-app'; app: InAppBrowser; os: 'ios' | 'android' }
  | { kind: 'unavailable' }

export interface InstallEnv {
  userAgent: string
  maxTouchPoints: number
  /** Running as the installed app (`display-mode: standalone`, or iOS's `navigator.standalone`). */
  standalone: boolean
  /** The browser reported the installation during this visit (`appinstalled`). */
  installedNow: boolean
  /** A captured `beforeinstallprompt` is waiting. */
  hasPrompt: boolean
}

/** iPhone, iPod, or an iPad (which reports itself as a Mac with a touch screen). */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)
}

const isAndroid = (userAgent: string) => /Android/i.test(userAgent)

/** Phones and tablets — where an install offer may open by itself. */
export function isMobileDevice(env: Pick<InstallEnv, 'userAgent' | 'maxTouchPoints'>): boolean {
  return isIosDevice(env.userAgent, env.maxTouchPoints) || isAndroid(env.userAgent)
}

// Messenger before Facebook: its user agent carries the Facebook tokens too.
const IN_APP: ReadonlyArray<readonly [RegExp, InAppBrowser]> = [
  [/Instagram/, 'instagram'],
  [/MessengerForiOS|Orca-Android|MessengerLite/, 'messenger'],
  [/FBAN\/|FBAV\/|FB_IAB\/|FBIOS|FBSS\//, 'facebook'],
  [/musical_ly|BytedanceWebview|TikTok/, 'tiktok'],
  [/Snapchat/, 'snapchat'],
  [/LinkedInApp/, 'linkedin'],
  [/\bLine\//, 'line'],
  [/MicroMessenger/, 'wechat'],
  // The Google app on iPhone; an Android WebView (`; wv)`) inside any other app.
  [/\bGSA\/|; wv\)/, 'other'],
]

/** The app whose built-in browser this is, if it is one. */
export function inAppBrowser(userAgent: string): InAppBrowser | undefined {
  return IN_APP.find(([pattern]) => pattern.test(userAgent))?.[1]
}

const OTHER_IOS_BROWSER = /FxiOS|EdgiOS|OPiOS|OPT\/|Ddg\/|YaBrowser/

export function detectInstallPlatform(env: InstallEnv): InstallPlatform {
  if (env.standalone || env.installedNow) return { kind: 'installed' }
  const ua = env.userAgent
  const ios = isIosDevice(ua, env.maxTouchPoints)
  const android = isAndroid(ua)
  if (ios || android) {
    const app = inAppBrowser(ua)
    // Even if such a browser offered to install, the app would live inside it, apart from the real browser.
    if (app) return { kind: 'in-app', app, os: ios ? 'ios' : 'android' }
  }
  if (env.hasPrompt) return { kind: 'native' }
  if (ios) {
    if (/CriOS\//.test(ua)) return { kind: 'ios-chrome' }
    if (OTHER_IOS_BROWSER.test(ua)) return { kind: 'ios-other' }
    const version = Number(ua.match(/Version\/(\d+)/)?.[1] ?? Number.NaN)
    // No version to go by: assume the current Safari.
    return { kind: 'ios-safari', layout: version < 26 ? 'toolbar' : 'menu' }
  }
  if (android) return { kind: 'android-menu' }
  return { kind: 'unavailable' }
}

/** Whether there is anything to offer: a button, steps, or the way out of an in-app browser. */
export function isInstallable(platform: InstallPlatform): boolean {
  return platform.kind !== 'installed' && platform.kind !== 'unavailable'
}

/** Opens `url` in Chrome from an Android in-app browser; where Chrome is missing, the plain link opens instead. */
export function chromeIntentUrl(url: string): string {
  const { host, pathname, search } = new URL(url)
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}
