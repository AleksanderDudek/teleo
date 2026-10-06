import { describe, expect, it } from 'vitest'
import { utteranceSilenceMs } from './pauses'

describe('utteranceSilenceMs', () => {
  it('keeps short sentences snappy and lets long ones breathe, up to 3 s', () => {
    expect(utteranceSilenceMs(0)).toBe(1500)
    expect(utteranceSilenceMs(10)).toBe(1500)
    expect(utteranceSilenceMs(20)).toBe(2100)
    expect(utteranceSilenceMs(30)).toBe(2700)
    expect(utteranceSilenceMs(35)).toBe(3000)
    expect(utteranceSilenceMs(40)).toBe(3000)
  })
})
