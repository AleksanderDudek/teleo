import { isIosDevice } from './install'

/*
 * Getting a file off the device (DECISIONS #110). A download stays on the same phone or computer; the system share
 * sheet (Web Share with files: iOS 15+, Android, Chromium on Windows/ChromeOS/macOS) reaches Files, iCloud Drive,
 * Google Drive, e-mail and messengers — where a backup outlives the browser.
 */

/** The share sheet can take this file. */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true
  } catch {
    return false
  }
}

export type ShareFileResult = 'shared' | 'cancelled' | 'failed'

/** Opens the share sheet; must run straight from a tap (no slow work before it, iOS checks). */
export async function shareFile(file: File, title: string): Promise<ShareFileResult> {
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

/**
 * On iPhone and iPad the share sheet is the way to Files and iCloud; a download in an installed app may only open
 * a preview. Elsewhere downloading is the familiar first choice.
 */
export function prefersShare(): boolean {
  return typeof navigator !== 'undefined' && isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0)
}
