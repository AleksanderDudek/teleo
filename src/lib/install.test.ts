import { describe, expect, it } from 'vitest'
import { isIosDevice, resolveInstallState } from './install'

describe('install', () => {
  it('recognises iPhones and iPads, including iPads that present themselves as a Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15) Chrome', 5)).toBe(false)
  })

  it('offers installation only where it can happen, and never inside the installed app', () => {
    const base = { standalone: false, installedNow: false, hasPrompt: false, ios: false }
    expect(resolveInstallState(base)).toBe('unavailable')
    expect(resolveInstallState({ ...base, hasPrompt: true })).toBe('prompt')
    expect(resolveInstallState({ ...base, ios: true })).toBe('ios')
    expect(resolveInstallState({ ...base, standalone: true, hasPrompt: true })).toBe('installed')
    expect(resolveInstallState({ ...base, installedNow: true, ios: true })).toBe('installed')
  })
})
