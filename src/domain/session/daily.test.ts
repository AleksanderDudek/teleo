import { describe, expect, it } from 'vitest'
import { pickDailyTexts } from './daily'

describe('pickDailyTexts', () => {
  it('returns nothing when there are no candidates', () => {
    expect(pickDailyTexts({ candidates: [], practicedToday: new Set(), targetSegments: 10 })).toEqual([])
  })

  it('drops texts already practiced today', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'a', segmentCount: 5 },
        { id: 'b', segmentCount: 5 },
      ],
      practicedToday: new Set(['a']),
      targetSegments: 100,
    })
    expect(result).toEqual(['b'])
  })

  it('drops texts with zero segments', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'a', segmentCount: 0 },
        { id: 'b', segmentCount: 5 },
      ],
      practicedToday: new Set(),
      targetSegments: 100,
    })
    expect(result).toEqual(['b'])
  })

  it('orders never-practiced texts first, then by ascending lastPracticedAt', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'old', segmentCount: 1, lastPracticedAt: 100 },
        { id: 'never', segmentCount: 1 },
        { id: 'recent', segmentCount: 1, lastPracticedAt: 200 },
      ],
      practicedToday: new Set(),
      targetSegments: 100,
    })
    expect(result).toEqual(['never', 'old', 'recent'])
  })

  it('is stable for ties in lastPracticedAt (including ties among never-practiced)', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'n1', segmentCount: 1 },
        { id: 'n2', segmentCount: 1 },
        { id: 't1', segmentCount: 1, lastPracticedAt: 50 },
        { id: 't2', segmentCount: 1, lastPracticedAt: 50 },
      ],
      practicedToday: new Set(),
      targetSegments: 100,
    })
    expect(result).toEqual(['n1', 'n2', 't1', 't2'])
  })

  it('adds texts while the running total is below the target', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'a', segmentCount: 3 },
        { id: 'b', segmentCount: 3 },
        { id: 'c', segmentCount: 3 },
        { id: 'd', segmentCount: 3 },
      ],
      practicedToday: new Set(),
      targetSegments: 8,
    })
    // a(3) -> total 3 < 8; b(3) -> total 6 < 8; c(3) -> total 9 >= 8, stop.
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('skips (without stopping) a text that would push the total above 150', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'a', segmentCount: 100 },
        { id: 'b', segmentCount: 100 },
        { id: 'c', segmentCount: 10 },
      ],
      practicedToday: new Set(),
      targetSegments: 150,
    })
    // a -> total 100. b would push to 200 (>150) so it's skipped. c -> total 110.
    expect(result).toEqual(['a', 'c'])
  })

  it('always returns at least one text, even if it alone exceeds 150', () => {
    const result = pickDailyTexts({
      candidates: [
        { id: 'huge', segmentCount: 200 },
        { id: 'small', segmentCount: 5 },
      ],
      practicedToday: new Set(),
      targetSegments: 10,
    })
    expect(result).toEqual(['huge'])
  })

  it('returns at least one text even when targetSegments is already satisfied at zero', () => {
    const result = pickDailyTexts({
      candidates: [{ id: 'a', segmentCount: 5 }],
      practicedToday: new Set(),
      targetSegments: 0,
    })
    expect(result).toEqual(['a'])
  })
})
