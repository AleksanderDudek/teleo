import { describe, expect, it } from 'vitest'
import { plantScene } from './plantScene'

const kinds = (level: number) => new Set(plantScene(level).parts.map((p) => p.kind))

describe('plantScene', () => {
  it('grows from a seed to a garden', () => {
    expect([...kinds(1)]).toEqual(['seed'])
    expect(kinds(3).has('leaf')).toBe(true)
    expect(kinds(7).has('bud')).toBe(true)
    expect(kinds(8).has('flower')).toBe(true)
    expect(kinds(9).has('fruit')).toBe(true)
    expect(kinds(12).has('crown')).toBe(true)
    expect(kinds(13).has('roots')).toBe(true)
    expect(plantScene(15).parts.filter((p) => p.kind === 'crown')).toHaveLength(3)
    expect(plantScene(17).parts.filter((p) => p.kind === 'crown')).toHaveLength(5)
    expect(kinds(20).has('sun')).toBe(true)
  })

  it('gets richer with every stage', () => {
    for (let level = 2; level <= 20; level++) {
      expect(plantScene(level).parts.length).toBeGreaterThanOrEqual(plantScene(1).parts.length)
    }
    expect(plantScene(10).parts.length).toBeGreaterThan(plantScene(5).parts.length)
  })

  it('adds gilded rings for circles beyond level 20', () => {
    expect(plantScene(20).rings).toBe(0)
    expect(plantScene(23)).toMatchObject({ stage: 20, rings: 3 })
    expect(plantScene(0)).toMatchObject({ stage: 1, rings: 0 })
  })
})
