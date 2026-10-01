import { describe, expect, it } from 'vitest'
import { formatBytes } from './format'

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(512, 'en')).toBe('512 byte')
    expect(formatBytes(84_300, 'en')).toBe('84 kB')
    expect(formatBytes(2_450_000, 'en')).toBe('2.5 MB')
    expect(formatBytes(2_450_000, 'pl')).toBe('2,5 MB')
  })
})
