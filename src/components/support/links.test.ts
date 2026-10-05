import { describe, expect, it } from 'vitest'
import { supportUrl, tipOfTheDay } from './links'

describe('support', () => {
  it('sends Polish users to buycoffee.to and everyone else to buymeacoffee.com', () => {
    expect(supportUrl('pl')).toBe('https://buycoffee.to/uriel')
    expect(supportUrl('en')).toBe('https://buymeacoffee.com/atd_uriel')
  })

  it('keeps one tip for a whole day and changes it the next day', () => {
    expect(tipOfTheDay('2026-09-27')).toBe(tipOfTheDay('2026-09-27'))
    expect(tipOfTheDay('2026-09-28')).not.toBe(tipOfTheDay('2026-09-27'))
    const tenDays = Array.from({ length: 10 }, (_, i) => tipOfTheDay(`2026-10-${String(i + 1).padStart(2, '0')}`))
    expect(new Set(tenDays).size).toBe(10)
  })

  it('falls back to the first tip for a malformed day', () => {
    expect(tipOfTheDay('not a day')).toBe('support.tip1')
  })
})
