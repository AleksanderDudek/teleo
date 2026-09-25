import { describe, expect, it } from 'vitest'
import { createProgressAggregator, progressPercent } from './progress'

const expected = { 'config.json': 100, 'onnx/encoder.onnx': 900, runtime: 1_000 }

describe('createProgressAggregator', () => {
  it('starts at zero of the expected total', () => {
    expect(createProgressAggregator(expected).current).toEqual({ loaded: 0, total: 2_000 })
  })

  it('sums the bytes of every file', () => {
    const progress = createProgressAggregator(expected)
    progress.update('config.json', 100, 100)
    expect(progress.update('onnx/encoder.onnx', 450, 900)).toEqual({ loaded: 550, total: 2_000 })
  })

  it('grows the total for unexpected or bigger files', () => {
    const progress = createProgressAggregator(expected)
    progress.update('processor_config.json', 10, 50)
    expect(progress.update('onnx/encoder.onnx', 100, 1_200)).toEqual({ loaded: 110, total: 2_350 })
  })

  it('marks a file complete (e.g. read from the cache without byte events)', () => {
    const progress = createProgressAggregator(expected)
    expect(progress.finish('runtime')).toEqual({ loaded: 1_000, total: 2_000 })
  })

  it('never goes backwards', () => {
    const progress = createProgressAggregator(expected)
    progress.update('onnx/encoder.onnx', 600, 900)
    expect(progress.update('onnx/encoder.onnx', 200, 900).loaded).toBe(600)
  })

  it('never reports more than the total', () => {
    const progress = createProgressAggregator(expected)
    expect(progress.update('config.json', 5_000, 100)).toEqual({ loaded: 5_000, total: 6_900 })
    expect(progress.update('runtime', 2_000)).toEqual({ loaded: 7_000, total: 7_900 })
  })
})

describe('progressPercent', () => {
  it('is a whole percentage between 0 and 100', () => {
    expect(progressPercent({ loaded: 0, total: 0 })).toBe(0)
    expect(progressPercent({ loaded: 999, total: 2_000 })).toBe(49)
    expect(progressPercent({ loaded: 2_000, total: 2_000 })).toBe(100)
    expect(progressPercent({ loaded: 3_000, total: 2_000 })).toBe(100)
  })
})
