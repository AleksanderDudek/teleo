import { describe, expect, it } from 'vitest'
import { chromeIntentUrl, detectInstallPlatform, inAppBrowser, isInstallable, isIosDevice, isMobileDevice, type InstallEnv } from './platform'

const UA = {
  safari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  safari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/144.0 Mobile/15E148 Safari/605.1.15',
  edgeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 EdgiOS/141.0.3537.71 Mobile/15E148 Safari/605.1.15',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 401.0.0.42.75 (iPhone15,3; iOS 18_6; pl_PL; pl; scale=3.00; 1290x2796; 798452231)',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.43.107;FBBV/790211370;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/pl_PL;FBOP/80]',
  messengerIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/530.0.0.30.110;FBBV/790305581;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/pl_PL;FBOP/5]',
  googleAppIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/390.0.794588014 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP4A.250105.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/530.0.0.46.109;]',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP4A.250105.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/530.0.0.30.110;]',
  tiktokAndroid: 'Mozilla/5.0 (Linux; Android 15; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 trill_410203 BytedanceWebview/d8a21c6 musical_ly_2024102030',
  webviewAndroid: 'Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP4A.250105.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  desktopSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
}

const env = (userAgent: string, rest: Partial<InstallEnv> = {}): InstallEnv => ({
  userAgent,
  maxTouchPoints: userAgent.includes('Macintosh') ? 0 : 5,
  standalone: false,
  installedNow: false,
  hasPrompt: false,
  ...rest,
})

describe('install platform', () => {
  it('recognises iPhones and iPads, including iPads that present themselves as a Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15) Chrome', 5)).toBe(false)
  })

  it('counts phones and tablets as mobile, desktops not', () => {
    expect(isMobileDevice(env(UA.safari26))).toBe(true)
    expect(isMobileDevice(env(UA.ipadDesktop, { maxTouchPoints: 5 }))).toBe(true)
    expect(isMobileDevice(env(UA.firefoxAndroid))).toBe(true)
    expect(isMobileDevice(env(UA.desktopChrome))).toBe(false)
    expect(isMobileDevice(env(UA.desktopSafari))).toBe(false)
  })

  it('is installed inside the installed app, whatever else the browser says', () => {
    expect(detectInstallPlatform(env(UA.safari26, { standalone: true }))).toEqual({ kind: 'installed' })
    expect(detectInstallPlatform(env(UA.chromeAndroid, { installedNow: true, hasPrompt: true }))).toEqual({ kind: 'installed' })
  })

  it('installs in one tap where the browser offered it', () => {
    expect(detectInstallPlatform(env(UA.chromeAndroid, { hasPrompt: true }))).toEqual({ kind: 'native' })
    expect(detectInstallPlatform(env(UA.desktopChrome, { hasPrompt: true }))).toEqual({ kind: 'native' })
  })

  it('tells new Safari (Share in the ⋯ menu) from older Safari (Share in the toolbar)', () => {
    expect(detectInstallPlatform(env(UA.safari26))).toEqual({ kind: 'ios-safari', layout: 'menu' })
    expect(detectInstallPlatform(env(UA.safari18))).toEqual({ kind: 'ios-safari', layout: 'toolbar' })
    expect(detectInstallPlatform(env(UA.ipadDesktop, { maxTouchPoints: 5 }))).toEqual({ kind: 'ios-safari', layout: 'menu' })
  })

  it('gives Chrome on iPhone its own steps and other iPhone browsers general ones', () => {
    expect(detectInstallPlatform(env(UA.chromeIos))).toEqual({ kind: 'ios-chrome' })
    expect(detectInstallPlatform(env(UA.firefoxIos))).toEqual({ kind: 'ios-other' })
    expect(detectInstallPlatform(env(UA.edgeIos))).toEqual({ kind: 'ios-other' })
  })

  it('shows the menu path on Android browsers that did not offer one-tap install', () => {
    expect(detectInstallPlatform(env(UA.chromeAndroid))).toEqual({ kind: 'android-menu' })
    expect(detectInstallPlatform(env(UA.firefoxAndroid))).toEqual({ kind: 'android-menu' })
  })

  it('names the app whose built-in browser cannot install', () => {
    expect(inAppBrowser(UA.instagramIos)).toBe('instagram')
    expect(inAppBrowser(UA.facebookIos)).toBe('facebook')
    expect(inAppBrowser(UA.messengerIos)).toBe('messenger')
    expect(inAppBrowser(UA.messengerAndroid)).toBe('messenger')
    expect(inAppBrowser(UA.facebookAndroid)).toBe('facebook')
    expect(inAppBrowser(UA.tiktokAndroid)).toBe('tiktok')
    expect(inAppBrowser(UA.googleAppIos)).toBe('other')
    expect(inAppBrowser(UA.webviewAndroid)).toBe('other')
    for (const ua of [UA.safari26, UA.chromeIos, UA.firefoxIos, UA.chromeAndroid, UA.firefoxAndroid]) expect(inAppBrowser(ua)).toBeUndefined()
  })

  it('sends in-app browsers to the real browser, even when one claims it could install', () => {
    expect(detectInstallPlatform(env(UA.instagramIos))).toEqual({ kind: 'in-app', app: 'instagram', os: 'ios' })
    expect(detectInstallPlatform(env(UA.facebookAndroid, { hasPrompt: true }))).toEqual({ kind: 'in-app', app: 'facebook', os: 'android' })
  })

  it('has nothing to offer on a desktop browser without one-tap install', () => {
    expect(detectInstallPlatform(env(UA.desktopSafari))).toEqual({ kind: 'unavailable' })
    expect(detectInstallPlatform(env(UA.desktopChrome))).toEqual({ kind: 'unavailable' })
  })

  it('offers installation everywhere except inside the app and where nothing can be offered', () => {
    expect(isInstallable({ kind: 'installed' })).toBe(false)
    expect(isInstallable({ kind: 'unavailable' })).toBe(false)
    expect(isInstallable({ kind: 'native' })).toBe(true)
    expect(isInstallable({ kind: 'in-app', app: 'instagram', os: 'ios' })).toBe(true)
  })

  it('opens the page in Chrome from an Android in-app browser, falling back to the plain link', () => {
    expect(chromeIntentUrl('https://example.github.io/teleo/')).toBe(
      'intent://example.github.io/teleo/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fexample.github.io%2Fteleo%2F;end',
    )
  })
})
